/**
 * One-time migration: rename the `documentType` discriminator values in the
 * `trustees` collection from TRUSTEE_ASSISTANT/AUDIT_ASSISTANT to
 * TRUSTEE_STAFF/AUDIT_STAFF, matching the code rename in CAMS-826.
 *
 * Safe to re-run: each update only matches documents still on the old
 * documentType value, so documents already renamed by a prior run are
 * skipped.
 *
 * Usage (mongosh):
 *   mongosh "<connection-string>" ops/migrations/CAMS-826-rename-staff-documenttype.js
 *
 * Or from an existing mongosh session already connected to the target
 * database:
 *   load('ops/migrations/CAMS-826-rename-staff-documenttype.js')
 */

(function () {
  const collection = db.getCollection('trustees');

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
