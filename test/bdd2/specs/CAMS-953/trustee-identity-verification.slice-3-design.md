# Trustee Identity Verification - Slice 3 Design

## Metadata

- **Slice:** 3 of 7
- **Slice Name:** Explanations
- **Ticket:** CAMS-953 (GitHub #3187); beads `cams-c45pn.6`, child `cams-c45pn.6.1` (seed generator)
- **Dependencies:** Slice 2 (`cams-c45pn.5`, merged to `CAMS-953-full-feature` in d8a7f1d58)
- **User Value:** The verifier understands why CAMS needed a human decision.
- **Status:** In Design (2026-10-28)

## Governing principle

The UI reads the verdicts the trustee-match pipeline already stored in `findings`. It never re-runs
or re-invents a comparison. Every scorer runs after normalization and every candidate is scored
against the same source record, so the stored `ScoreByScorer` values answer each question this slice
asks.

## Slice Scope

**In scope:**

1. **Seed generator (`cams-c45pn.6.1`), done first.** It runs the real pipeline against fixture
   source and candidate records and captures its serialized state as seed `findings`, replacing
   hand-written `ScoreByScorer` values. Reason: the sentences below read the scores directly. A
   hand-derived score was wrong twice in Slice 2 (street closeness "301" vs "300 Match Ave" is 2/3,
   not 0.5), so UI tests would run against data the pipeline cannot produce.
2. **"Why CAMS needs you" sentence.** It replaces the generic problem statement ("Trustee sent from
   the court does not match a CAMS Trustee for …", `TrusteeMatchVerificationAccordion.tsx` ~line
   462). Following Katie's rule, only a one-candidate task spells out details; the others get one
   generic sentence.

   | Candidates | Sentence                                                                                      |
   | ---------- | --------------------------------------------------------------------------------------------- |
   | 0          | Trustee information sent to CAMS does not match any trustee in CAMS. Affects X cases:         |
   | 2+         | Trustee information sent to CAMS matches multiple trustees in CAMS. Affects X cases:          |
   | 1          | Trustee {fields} sent to CAMS {does/do} not exactly match a trustee in CAMS. Affects X cases: |

   For one candidate, `{fields}` is built from the rows the comparison table already marks as
   differing (`differingRows` in `trustee-comparison.ts`, which reads the stored scores):
   - Rows are grouped: name; address (street, city, zip); state; phone; email.
   - Groups are listed in the fixed order name, address, state, phone, email (not table order, which
     would give "phone and address") and joined as "a, b and c".
   - The verb is "does" for one group and "do" for two or more.
   - When no row is marked, `{fields}` is "information".
   - The mock's "address and phone" sentence is one output of this template. The mock's state
     sentence ("does not match", with no "exactly") is not reproduced verbatim.

3. **"How CAMS read this name".** Shown only on a one-candidate task whose candidate's
   `doesNameMatch` is not `quality: 'exact'`. It shows the raw source name
   (`findings.sourceRaw.fullName`) as received; the lowercase normalized parts are not displayed
   (user, 2026-10-28). Tasks with no candidates or with several never show it.

**Out of scope:**

- **ACMS professional id.** Removed by the user (2026-10-28): it is not displayed anywhere. It stays
  stored on the task.
- **Possible-duplicate flag.** Removed by the user (2026-10-28): duplicate CAMS trustees are just
  candidates in the comparison table, with no special treatment. Overrides refinement decision 3
  ("flag only").
- The zero-cases sentence variant ("No cases affected yet"). Slice 5 (caseless tasks).
- "Covers these cases", the approval preview, "(Not yet in CAMS)". Slice 4.
- Any change to the pipeline, the DXTR sync or the task shape.

## Strategic Design Decisions

### Architecture approach

The explanation is presentation logic over stored facts, so it lives in the `data-verification`
feature folder, beside `trustee-comparison.ts`, as a pure function from `findings` to the
explanation (sentence kind, field groups, whether to show the name section). No new boundary, no
backend change: the detail endpoint already returns `findings`. It reuses `differingRows`, so the
table's warning icons and the sentence cannot disagree.

### Component responsibilities

- **UI layer:** a pure mapper (findings → explanation) plus rendering in
  `TrusteeMatchVerificationAccordion.tsx`. The sentence keeps the existing "Affects X cases:" link
  list (`caseLink`).
- **Seed tooling:** the generator is a backend Vitest test. It runs `runTrusteeMatchPipeline` over
  fixture scenarios, with the trustees repository served in memory, and writes the serialized states
  to a checked-in JSON file under `common/src/cams/test-utilities/`. It cannot live in dev-tools:
  dev-tools cannot import backend (`dev-tools/db_scripts/lib/compute-fingerprint.ts:8-10`).
  Consumers import the JSON (common, dev-tools, user-interface) or read it with `readFileSync` (e2e
  and ui-sandbox seed scripts).
- **Use case / gateway / repository / API:** no change.

### Trade-offs & Decisions

1. **Sentences come from stored scores, not from a UI comparison.**
   - Alternative considered: compare raw and normalized values in the UI.
   - Rationale: the pipeline already recorded its verdicts; a second comparison could disagree with
     them and with the table's icons.
2. **One-candidate sentence is built from field groups.**
   - Alternatives considered: the mock's two fixed sentences with "state wins"; a per-field list;
     the fixed sentence plus a detail line.
   - Rationale: the sentence always names what actually differs, and it still reproduces the mock's
     "address and phone" sentence.
3. **The name section reads `doesNameMatch` quality.**
   - Alternatives considered: compare raw to normalized (normalized names are always lowercase with
     punctuation stripped, so it would show on nearly every task); have the pipeline record which
     name recoveries fired.
   - Rationale: the score is the pipeline's post-normalization verdict on the name.
   - Accepted consequence: a name the normalizer recovered that then scores exact (raw "SMITH, JOHN"
     swapped to john/smith) shows no section. The raw name is still in the source column.
4. **Seed generator before the UI work.**
   - Alternative considered: hand-written seeds plus a stronger validator.
   - Rationale: the UI is only as trustworthy as its fixtures, and hand-scoring has drifted.

## Integration Points

- **Slice 2:** `buildTrusteeComparison`, `differingRows` and `rankCandidates`
  (`common/src/cams/trustee-match-pipeline.ts`); the accordion's header, problem statement and
  `caseLink`.
- **Seeds regenerated from the generator:**
  - `dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.ts`
  - `dev-tools/db_scripts/scenarios/trustee-data.ts`
  - `test/e2e/fixtures/mongo-fixture.json`
  - `test/ui-sandbox/scripts/seed.ts`
  - `user-interface/src/lib/testing/mock-api2.ts` (must stay plain literals, since it ships in the
    app bundle)
- **Existing tests asserting the old problem statement:** accordion unit tests,
  `test/e2e/playwright/trustee-match-verification.spec.ts`.

## Testing strategy

- **Unit:** the mapper, covering:
  - each candidate count (0, 1, 2+)
  - each field group, alone and combined
  - "does" vs "do"
  - the "information" fallback
  - the name section shown only for one candidate with a non-exact name

  Plus accordion rendering, and the generator (real pipeline output matches the stored seeds).

- **Playwright e2e:** one task per sentence kind, plus the name section present and absent.
- **Playwright a11y:** `user-interface/test/accessibility/data-verification.test.ts`; the name
  section has a heading in the existing order.
- **Integration (`test/integration/trustee-match-scenarios`):** assert that the stored `findings`
  for the no-match and ambiguous scenarios carry the scores the sentence reads.

## Test data

- Every identity-task seed is regenerated from the seed generator.
- New scenarios:
  - one candidate where only state differs
  - one candidate where address and phone differ
  - one candidate where name, address and email differ
  - one candidate with nothing marked
  - one candidate with a non-exact name (name section shown)
  - one candidate with an exact name (no section)
  - existing 0 and 2+ candidate tasks
- `trustee-identity-verification.test-data.md` and `docs/operations/test-data-catalog.md` are
  updated in Phase 3 tasks.

## Open Questions for Phase 3

- Resolved 2026-10-28: generator output is checked-in JSON plus a drift test; the name section shows
  the raw source name; the professional id is not displayed anywhere.
- **"No field marked" with one candidate.** The pipeline may never produce it, since a single
  candidate matching on every field would resolve. If the generator cannot produce it, keep the
  "information" fallback in the mapper's unit tests only.
- **UX sign-off** from the mock's designer (Brian Posey) on the generated sentences, which differ
  from the mock's copy.

## Design Q&A Summary (2026-10-28)

- Q: One-candidate sentence when several fields differ? A: Build it from the differing fields,
  grouped (name / address / state / phone / email).
- Q: How does the UI decide whether a name was reinterpreted? A: Read it from the scoring
  (`doesNameMatch` quality); don't re-invent the comparison.
- Q: Which candidate's score? A: Only one-candidate tasks spell out details (Katie); several
  candidates get the generic sentence.
- Q: Possible duplicates? A: Every candidate is scored. Then, finally: no special highlighting, just
  display the candidates.
- Q: ACMS professional id in the header? A: No, not in any header.
- Q: Seed generator (`cams-c45pn.6.1`)? A: Do it first, in Slice 3.
