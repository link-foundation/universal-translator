// A null observation is intentionally open across the full confidence range.
function frequency(observation) {
  if (observation === null || observation === undefined) {
    return undefined;
  }
  const { count, total } = observation;
  if (
    !Number.isInteger(count) ||
    !Number.isInteger(total) ||
    count < 0 ||
    total <= 0 ||
    total > 4294967295 ||
    count > total
  ) {
    throw new Error('Invalid corpus observation');
  }
  return count / total;
}

function score(candidate) {
  const { context } = candidate;
  if (
    context !== null &&
    context !== undefined &&
    (!Number.isFinite(context) || context < 0 || context > 1)
  ) {
    throw new Error('Invalid contextual confidence');
  }
  const evidence = [
    frequency(candidate.sourceEvidence),
    frequency(candidate.targetEvidence),
    context,
  ];
  return [0, 1].map(
    (bound) =>
      Math.round(
        Math.min(...evidence.map((value) => value ?? bound)) * 1000000
      ) / 1000000
  );
}

function compareEvidence(left, right) {
  return (
    Number(right.roundTrip) - Number(left.roundTrip) ||
    right.confidence[0] - left.confidence[0] ||
    right.confidence[1] - left.confidence[1]
  );
}

export function rankInterpretations(source, candidates, requiredType = []) {
  const identifiers = new Set();
  const ranked = [];
  for (const candidate of candidates) {
    if (
      typeof candidate.id !== 'string' ||
      !candidate.id ||
      /[^A-Za-z0-9_-]/.test(candidate.id) ||
      identifiers.has(candidate.id) ||
      !Array.isArray(candidate.type) ||
      candidate.type.length === 0 ||
      !Array.isArray(candidate.back)
    ) {
      throw new Error('Invalid or duplicate interpretation');
    }
    identifiers.add(candidate.id);
    if (requiredType.every((part, index) => candidate.type[index] === part)) {
      ranked.push({
        ...candidate,
        roundTrip: candidate.back.includes(source),
        confidence: score(candidate),
      });
    }
  }
  ranked.sort(
    (left, right) =>
      compareEvidence(left, right) ||
      (left.id < right.id ? -1 : Number(left.id > right.id))
  );
  return {
    candidates: ranked,
    preferred: ranked.filter(
      (candidate) => compareEvidence(ranked[0], candidate) === 0
    ),
  };
}
