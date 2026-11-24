---
'@link-foundation/universal-translator': minor
---

Translate between programming languages and controlled natural languages.

- Controlled versions of the 30 most spoken natural languages, described as data in `data/natural/*.lino`, are read and written like programming languages: words → meta → any programming or machine language, and back.
- Profiles for ASD-STE100, Attempto Controlled English, Gellish (English and Dutch), SBVR Structured English, plain language (ISO 24495-1), E-Prime, Basic English, Special English, Globish and Minimal English, French and Polish built on the 65 semantic primes of Natural Semantic Metalanguage. `checkText` and the `check-words` command enforce each standard's rules.
- Every example program is written in every natural language and profile under `examples/programs/natural`, and both implementations check those texts.
- `scripts/check-requirements.mjs` fails CI while a requirement of issue 1 is neither done nor reported as blocked.
