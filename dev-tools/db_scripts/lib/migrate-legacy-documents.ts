import type { Db } from 'mongodb';

/**
 * Brings documents written under an older persisted shape up to the current one before seeding.
 * Every step must be idempotent: the runner calls this on every seed run.
 *
 * - CAMS-954 renamed TrusteeMatchVerification.dxtrTrustee to sourceTrustee without a data
 *   migration. Documents written before that deploy have no sourceTrustee, which crashes the
 *   Data Verification screen.
 */
export async function migrateLegacyDocuments(db: Db): Promise<void> {
  const { modifiedCount } = await db.collection('trustee-match-verification').updateMany(
    {
      documentType: 'TRUSTEE_MATCH_VERIFICATION',
      dxtrTrustee: { $exists: true },
      sourceTrustee: { $exists: false },
    },
    { $rename: { dxtrTrustee: 'sourceTrustee' } },
  );
  console.log(
    `[MIGRATE] trustee-match-verification: renamed dxtrTrustee -> sourceTrustee on ${modifiedCount} document(s)`,
  );
}
