/**
 * One-time migration: rename the `documentType` discriminator values in the
 * `trustees` collection from TRUSTEE_ASSISTANT/AUDIT_ASSISTANT to
 * TRUSTEE_STAFF/AUDIT_STAFF, and rename the `assistantId` field on
 * AUDIT_ASSISTANT documents to `staffId`, matching the code rename in
 * CAMS-826.
 *
 * Safe to re-run: each update only matches documents still on the old
 * documentType value or still holding the old field name, so documents
 * already renamed by a prior run are skipped.
 *
 * Usage: `load()` is not available in MongoDB Compass's embedded shell
 * (it returns a [COMMON-90002] error). Open this file, copy its contents,
 * and paste them directly into an interactive mongosh-compatible shell
 * (e.g. Compass's shell) connected to the target database.
 */

(function () {
  const collection = db.getCollection('trustees');

  const matchingField = collection.countDocuments({ assistantId: { $exists: true } });
  print(`Found ${matchingField} document(s) with field 'assistantId'.`);

  if (matchingField > 0) {
    const fieldResult = collection.updateMany(
      { assistantId: { $exists: true } },
      { $rename: { assistantId: 'staffId' } },
    );
    print(
      `  Renamed field on ${fieldResult.modifiedCount} document(s): 'assistantId' -> 'staffId'.`,
    );
  }

  const renames = [
    { from: 'TRUSTEE_ASSISTANT', to: 'TRUSTEE_STAFF' },
    { from: 'AUDIT_ASSISTANT', to: 'AUDIT_STAFF' },
  ];

  renames.forEach(({ from, to }) => {
    const matching = collection.countDocuments({ documentType: from });
    print(`Found ${matching} document(s) with documentType='${from}'.`);

    if (matching === 0) {
      return;
    }

    const result = collection.updateMany({ documentType: from }, { $set: { documentType: to } });
    print(`  Updated ${result.modifiedCount} document(s): '${from}' -> '${to}'.`);
  });

  print('Migration complete.');
})();
