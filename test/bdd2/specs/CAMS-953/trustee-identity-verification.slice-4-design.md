# Trustee Identity Verification - Slice 4 Design

## Metadata

- **Slice:** 4 of 7
- **Slice Name:** Approval preview (Confirm Trustee Match)
- **Ticket:** CAMS-953 (GitHub #3187); bead `cams-c45pn.7`
- **Dependencies:** Slice 3 (`cams-c45pn.6`, merged to `CAMS-953-full-feature` in 5e60062d3)
- **User Value:** The verifier confirms that the chosen trustee is the same person as the record
  sent to CAMS, and sees what approving does, before committing.
- **Status:** In Design (2026-10-29)

## Scope change from Phase 1 (user, 2026-10-29)

The prototypes no longer flag cases a trustee's appointments do not cover on the
trustee-match-verification screen. The new case appointment verification screen handles that edge
case. So this slice computes no case coverage at all. Dropped from the Phase 1 slice:

- the "Covers these cases" row in the comparison table
- the approval preview endpoint and any `getUncoveredCases` call on this screen
- listing uncovered cases as blocking, and disabling Match Trustee / Confirm for a partial-coverage
  candidate
- "{caseId} (Not yet in CAMS)". A forthcoming dataflow produces this, so it is not built here.

## Slice Scope

**In scope:**

1. **Confirm Trustee Match modal** replaces the current "Confirm Trustee" modal
   (`TrusteeMatchConfirmationModal.tsx`):
   - Title "Confirm Trustee Match".
   - Question "Is this the same trustee as the information sent to CAMS?"
   - Two columns: "Information Sent to CAMS" (the source record, plain) and "Selected CAMS Trustee"
     (the chosen trustee, with a warning icon on each differing field).
   - "What Happens Next": one sentence, "N cases will be assigned to {trustee name}." ("1 case will
     be assigned to …" for one case). The bulleted multi-outcome form belongs to CAMS-956 (#3190),
     which adds the appointment-task outcome, so it is not built here.
   - Submit button "Match Trustee". While the request is in flight it shows "Matching Trustee..."
     with a spinner. Cancel stays.
   - Inform only, with no acknowledgment checkbox (decision 5).
2. **Manual search uses the same modal.** Choosing a trustee in `TrusteeSearchModal` opens Confirm
   Trustee Match for that trustee, in place of the search modal's own "Confirm Appointment"
   approval.
3. **Remove the search modal's coverage check.** `TrusteeSearchModal.tsx:208-219` (Confirm disabled
   plus "Does not have an appointment covering case(s)…") is deleted, along with the accordion's
   `affectedCases` plumbing that only fed it.

**Out of scope:**

- Any case-coverage computation or display (see Scope change).
- **Backend gate A stays as is (user, 2026-10-29).** `approveVerification`
  (`trustee-match-verification.use-case.ts:226-275`) still rejects an approval whose trustee does
  not cover every affected case, or whose case lookup fails. With no UI warning, the verifier learns
  this only from the error alert after clicking Match Trustee. CAMS-956 (#3190) removes the gate.
- The zero-case "What Happens Next" text ("No cases are affected yet…"). Slice 5.
- "(Not yet in CAMS)". A forthcoming dataflow.
- Pagination and search coverage filter. Slice 7.

## Strategic Design Decisions

### Architecture approach

All of this is presentation in the `data-verification/trustee-verification` feature folder. There is
no backend, API, or common change. The modal's two columns come from the same comparison model the
table uses (`buildTrusteeComparison` in `trustee-comparison.ts`), so a field cannot have an icon in
the table and none in the modal, or the reverse.

### Component responsibilities

- **Comparison model (`trustee-comparison.ts`):** stays the single source of row values and the
  `differs` flags. The modal reads the source column and the chosen candidate's cells, minus the
  "Found by" row (it is about recall, not identity).
- **Confirm Trustee Match modal:** takes the source values and one selected trustee (values plus
  `differs` flags) and the affected case count. It renders the question, two columns, What Happens
  Next and the actions. It owns no fetching and no comparison logic.
- **Accordion:** opens the modal from either the table's Match Trustee button or the search modal,
  and keeps owning approval (`approveTrustee`, `isSubmittingRef`, `isProcessing`, focus on the
  resolved statement).
- **Search modal:** becomes a picker. Its submit hands the selected trustee to the accordion, which
  opens Confirm Trustee Match. It no longer approves directly or checks coverage.
- **Use case / gateway / repository / API:** no change.

### Trade-offs & Decisions

1. **No case coverage on this screen.**
   - Alternatives considered: a detail-endpoint field, a per-trustee preview endpoint, or a
     client-side `getUncoveredCases` per candidate (chosen briefly, then dropped).
   - Rationale: the prototypes moved coverage to the case appointment verification screen.
2. **Leave backend gate A in place.**
   - Alternative considered: remove it now, since the UI no longer warns.
   - Rationale (user): CAMS-956 owns removing it. The cost until then is that the verifier sees an
     error alert, not an up-front warning, when the trustee lacks coverage.
3. **A searched trustee gets no warning icons.**
   - Alternative considered: compare the searched trustee's values with the source in the UI.
   - Rationale: Slice 3's rule is that the UI reads the pipeline's stored verdicts and never
     re-invents a comparison. A searched trustee was never scored, so the UI has no verdict to show.
     If the searched trustee is also a candidate, use that candidate's stored cells.
4. **The table and modal share the comparison model.**
   - Alternative considered: keep `ConfirmationCandidate` (address/phone/email/appointments) as the
     modal input.
   - Rationale: the warning icons must agree with the table. The modal stops listing the trustee's
     appointments, which was only coverage context.
5. **Single-sentence What Happens Next.**
   - Rationale: approval has one outcome until CAMS-956 adds appointment tasks. Build the sentence
     so a second outcome can become a bullet list later, but do not build the list now (YAGNI).

## Integration Points

- **Slice 2/3:** `buildTrusteeComparison`, `differingRows`, `TrusteeComparisonTable`'s Match Trustee
  button (`aria-label="Match Trustee {name}"`), the accordion's `approveTrustee` / `handleApprove` /
  `handleManualMatch` and the `justApprovedRef` focus behavior.
- **Search modal:** `TrusteeSearchModal`'s submit and props (`affectedCases` removed; `chapter`,
  `courtId`, `divisionCode` stay as search filters).
- **Existing tests:**
  - `TrusteeMatchConfirmationModal.test.tsx`, `TrusteeSearchModal.test.tsx` and
    `TrusteeMatchVerificationAccordion.test.tsx`. The accordion test at ~line 826 asserts the search
    modal's coverage gate, so it changes.
  - `test/e2e/playwright/trustee-match-verification.spec.ts`. It asserts the modal name and the
    "Confirm Appointment" button.
  - `user-interface/test/accessibility/data-verification.test.ts`.

## Testing strategy

- **Unit:**
  - the modal: question, both column headings, icon only on differing fields, singular and plural
    case sentence, "Match Trustee" label, "Matching Trustee..." while processing, and Cancel
  - the accordion: candidate path and search path both open the modal and approve; the search modal
    no longer blocks on coverage
- **Playwright e2e:** open the preview from a candidate, assert the question, the icons on differing
  fields and the case sentence, then Cancel. Also run the search path through to the modal. The e2e
  specs that submit an approval are deferred to CAMS-956 (bead `cams-n9937`), because backend gate A
  rejects the fixture trustees. They are listed at the end of the Slice 4 prompts.
- **Playwright a11y:** axe with the Confirm Trustee Match modal open, for both a candidate and a
  searched trustee.
- **Integration harness (`test/integration/`):** nothing new. This slice changes no backend
  behavior, so the existing harness run is the regression check.

## Test data

No new seeds. The existing multi-case pending task (3 cases: `091-99-25850`, `091-99-26681`,
`091-99-26914`) covers "3 cases will be assigned to …" in dev. The single-case tasks cover the
singular sentence. Phase 3 checks whether the e2e fixture has a pending multi-case task, and adds
one from an existing `findingsScenario` if it does not.

## Open Questions for Phase 3

- What is the search modal's submit label now that it no longer approves? For example "Select
  Trustee" or "Continue".
- Does the search modal close when Confirm Trustee Match opens, and does Cancel in Confirm Trustee
  Match return to search or close both? Default: close search, and Cancel closes both.
- "Information Sent to CAMS" rows: use the comparison table rows minus "Found by" (Email only for
  DXTR).
- UX sign-off on the searched-trustee modal having no warning icons (decision 3).

## Design Q&A Summary (2026-10-29)

- Q: Where is per-candidate case coverage computed? A: Client-side at first, then not at all: the
  prototypes moved uncovered-case handling to the case appointment verification screen.
- Q: Backend gate A? A: Leave it alone for now (CAMS-956 removes it).
- Q: The search modal's coverage check? A: Remove it.
- Q: "(Not yet in CAMS)"? A: A forthcoming dataflow produces it; not in this slice.
- Q: Does manual search use the new modal? A: Yes, the same modal.
- Q: Submit label? A: "Match Trustee", with "Matching Trustee..." in flight.
