import { createAuditRecord } from './auditable';
import {
  IdentityMismatchReason,
  TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
  TrusteeMatchSource,
  TrusteeMatchVerification,
} from './trustee-match-verification';
import { TrusteeSerializedState } from './trustee-match-pipeline';

describe('trustee-match-verification', () => {
  test('TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE should equal TRUSTEE_MATCH_VERIFICATION', () => {
    expect(TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE).toBe('TRUSTEE_MATCH_VERIFICATION');
  });

  test('carries findings, source, and an identity mismatchReason', () => {
    const findings: TrusteeSerializedState = {
      sourceRaw: { fullName: 'Jane Doe' },
      sourceNormalized: {},
      memo: {},
      candidates: [],
      match: null,
      skip: false,
      error: null,
    };

    const source: TrusteeMatchSource = 'DXTR';
    const mismatchReason: IdentityMismatchReason = 'ambiguous';

    const task = createAuditRecord<TrusteeMatchVerification>({
      documentType: TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
      caseId: '081-22-11111',
      courtId: '0881',
      dxtrTrustee: { fullName: 'Jane Doe' },
      mismatchReason,
      source,
      findings,
      status: 'pending',
      taskType: 'trustee-match',
      fingerprint: 'fp-abc123',
      variant: '{"firstName":"jane","lastName":"doe"}',
    });

    expect(task.mismatchReason).toBe('ambiguous');
    expect(task.source).toBe('DXTR');
    expect(task.findings).toBe(findings);
  });
});
