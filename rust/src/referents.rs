use crate::meta::links::{self, Fields, Link};
use rml::probability::{Aggregator, TruthValue};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::HashSet;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Observation {
    pub count: u32,
    pub total: u32,
}

impl Observation {
    fn frequency(&self) -> Result<f64, String> {
        if self.total == 0 || self.count > self.total {
            return Err("Invalid corpus observation".into());
        }
        Ok(f64::from(self.count) / f64::from(self.total))
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub id: String,
    pub target: String,
    #[serde(rename = "type")]
    pub type_path: Vec<String>,
    pub back: Vec<String>,
    pub source_evidence: Option<Observation>,
    pub target_evidence: Option<Observation>,
    pub context: Option<f64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RankedCandidate {
    #[serde(flatten)]
    pub candidate: Candidate,
    pub round_trip: bool,
    pub confidence: [f64; 2],
}

#[derive(Debug, Serialize)]
pub struct Ranking {
    pub candidates: Vec<RankedCandidate>,
    pub preferred: Vec<RankedCandidate>,
}

/// Reads the source phrase and dependent candidates from a Links Notation document.
pub fn read_referent_input(source: &str) -> Result<(String, Vec<Candidate>), String> {
    let document =
        links_notation::parse_lino_to_links(source).map_err(|error| error.to_string())?;
    let [root] = document.as_slice() else {
        return Err("Expected one referents link".into());
    };
    let fields = links::fields(links::children(root, "referents")?)?;
    let candidates = links::elements(&fields, "candidates")?
        .iter()
        .map(read_candidate)
        .collect::<Result<_, _>>()?;
    Ok((links::value(&fields, "source")?, candidates))
}

fn read_candidate(link: &Link) -> Result<Candidate, String> {
    let fields = links::fields(links::children(link, "candidate")?)?;
    Ok(Candidate {
        id: links::value(&fields, "id")?,
        target: links::value(&fields, "target")?,
        type_path: links::references(links::elements(&fields, "type")?)?,
        back: links::references(links::elements(&fields, "back")?)?,
        source_evidence: read_observation(&fields, "sourceEvidence")?,
        target_evidence: read_observation(&fields, "targetEvidence")?,
        context: fields
            .get("context")
            .map(|values| {
                links::reference(values)?
                    .parse()
                    .map_err(|_| "Invalid context value".to_owned())
            })
            .transpose()?,
    })
}

fn read_observation(fields: &Fields, name: &str) -> Result<Option<Observation>, String> {
    fields
        .get(name)
        .map(|values| {
            let fields = links::fields(values)?;
            let number = |key| {
                links::value(&fields, key)?
                    .parse::<u32>()
                    .map_err(|_| format!("Invalid {key}"))
            };
            Ok(Observation {
                count: number("count")?,
                total: number("total")?,
            })
        })
        .transpose()
}

fn score(candidate: &Candidate) -> Result<[f64; 2], String> {
    if candidate
        .context
        .is_some_and(|value| !(0.0..=1.0).contains(&value))
    {
        return Err("Invalid contextual confidence".into());
    }
    let frequency = |observation: &Option<Observation>| {
        observation.as_ref().map(Observation::frequency).transpose()
    };
    let evidence = [
        frequency(&candidate.source_evidence)?,
        frequency(&candidate.target_evidence)?,
        candidate.context,
    ];
    Ok([0.0, 1.0].map(|bound| {
        Aggregator::Min
            .combine(&evidence.map(|value| TruthValue::new(value.unwrap_or(bound))))
            .get()
    }))
}

fn compare_evidence(left: &RankedCandidate, right: &RankedCandidate) -> Ordering {
    right
        .round_trip
        .cmp(&left.round_trip)
        .then_with(|| right.confidence[0].total_cmp(&left.confidence[0]))
        .then_with(|| right.confidence[1].total_cmp(&left.confidence[1]))
}

pub fn rank_interpretations(
    source: &str,
    candidates: &[Candidate],
    required_type: &[String],
) -> Result<Ranking, String> {
    let mut identifiers = HashSet::new();
    let mut ranked = Vec::new();
    for candidate in candidates {
        let id = &candidate.id;
        if id.is_empty()
            || !id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b"_-".contains(&byte))
            || !identifiers.insert(id)
            || candidate.type_path.is_empty()
        {
            return Err("Invalid or duplicate interpretation".into());
        }
        if candidate.type_path.starts_with(required_type) {
            ranked.push(RankedCandidate {
                candidate: candidate.clone(),
                round_trip: candidate.back.iter().any(|back| back == source),
                confidence: score(candidate)?,
            });
        }
    }
    ranked.sort_by(|left, right| {
        compare_evidence(left, right).then_with(|| left.candidate.id.cmp(&right.candidate.id))
    });
    let preferred = ranked
        .iter()
        .take_while(|candidate| compare_evidence(&ranked[0], candidate).is_eq())
        .cloned()
        .collect();
    Ok(Ranking {
        candidates: ranked,
        preferred,
    })
}
