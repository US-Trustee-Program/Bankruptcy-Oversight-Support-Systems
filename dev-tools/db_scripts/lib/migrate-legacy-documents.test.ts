import { describe, test, expect, vi } from 'vitest';
import type { Db } from 'mongodb';
import { migrateLegacyDocuments } from './migrate-legacy-documents.js';

function fakeDb(modifiedCount = 0) {
  const updateMany = vi.fn().mockResolvedValue({ modifiedCount });
  const collection = vi.fn().mockReturnValue({ updateMany });
  return { db: { collection } as unknown as Db, collection, updateMany };
}

describe('migrateLegacyDocuments', () => {
  test('renames dxtrTrustee to sourceTrustee on trustee match verifications that lack sourceTrustee', async () => {
    const { db, collection, updateMany } = fakeDb(3);

    await migrateLegacyDocuments(db);

    expect(collection).toHaveBeenCalledWith('trustee-match-verification');
    expect(updateMany).toHaveBeenCalledWith(
      {
        documentType: 'TRUSTEE_MATCH_VERIFICATION',
        dxtrTrustee: { $exists: true },
        sourceTrustee: { $exists: false },
      },
      { $rename: { dxtrTrustee: 'sourceTrustee' } },
    );
  });

  test('is a no-op when there is nothing left to migrate', async () => {
    const { db, updateMany } = fakeDb(0);

    await expect(migrateLegacyDocuments(db)).resolves.toBeUndefined();
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
