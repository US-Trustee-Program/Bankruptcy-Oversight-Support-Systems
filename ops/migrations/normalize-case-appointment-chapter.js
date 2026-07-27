/**
 * One-time data repair: fix up legacy ACMS chapter codes on CASE_APPOINTMENT
 * documents that were copied verbatim from CURR_CASE_CHAPT before the
 * ACMS-to-CAMS case-appointment migration (migrate-case-appointments)
 * normalized them at write time. Three fixes:
 *
 *   - '7A' (asset) / '7N' (no-asset) -> '7'. CAMS treats these ACMS chapter 7
 *     sub-codes inclusively as chapter 7. This is what shows up as "7A"/"7N"
 *     in the trustee case list, and causes chapter-7 filtering (an exact-match
 *     query) to miss those cases.
 *   - '09' -> '9'. ACMS's CURR_CASE_CHAPT is unpadded; DXTR-sourced documents
 *     use '9', so any '09' left over is inconsistent with the rest of CAMS.
 *   - 'AC' documents are deleted outright. 'AC' is the predecessor to chapter
 *     15 and was never meant to be imported into CAMS (see the chapter
 *     comment on AcmsGatewayImpl.getLeadCaseIds) — any that made it in
 *     represent appointments that should not exist in CAMS at all.
 *
 * CASE_APPOINTMENT documents are dual-written to two collections (matching
 * partition keys used by the repository) — both must be fixed:
 *   - case-trustee-appointments   (partition key: caseId)
 *   - trustee-case-appointments   (partition key: trusteeId)
 *
 * Idempotent: only matches documents still carrying one of the raw codes
 * above. Documents already fixed by a prior run are skipped.
 *
 * Dry run by default: reports what would change without writing anything.
 * Set the CONFIRM environment variable to 'true' to actually apply changes.
 *
 * Usage (mongosh):
 *   mongosh "<connection-string>" ops/migrations/normalize-case-appointment-chapter.js
 *   CONFIRM=true mongosh "<connection-string>" ops/migrations/normalize-case-appointment-chapter.js
 *
 * Or from an existing mongosh session already connected to the target
 * database:
 *   load('ops/migrations/normalize-case-appointment-chapter.js')
 *   process.env.CONFIRM = 'true'; load('ops/migrations/normalize-case-appointment-chapter.js')
 */

(function () {
  const DRY_RUN = process.env.CONFIRM !== 'true';
  const COLLECTIONS = ['case-trustee-appointments', 'trustee-case-appointments'];

  const RENAMES = [
    { from: ['7A', '7N'], to: '7' },
    { from: ['09'], to: '9' },
  ];
  const DELETE_CHAPTERS = ['AC'];

  if (DRY_RUN) {
    print("DRY RUN: no documents will be modified. Set CONFIRM='true' to apply changes.");
  }

  COLLECTIONS.forEach((collectionName) => {
    const collection = db.getCollection(collectionName);

    RENAMES.forEach(({ from, to }) => {
      const filter = { documentType: 'CASE_APPOINTMENT', chapter: { $in: from } };
      const matching = collection.countDocuments(filter);

      print(
        `[${collectionName}] Found ${matching} CASE_APPOINTMENT document(s) with chapter in [${from.join(', ')}].`,
      );

      if (matching === 0) {
        print(`[${collectionName}] Nothing to do for [${from.join(', ')}] -> '${to}'.`);
        return;
      }

      if (DRY_RUN) {
        collection.find(filter).forEach(function (doc) {
          print(`  Would update ${doc._id}: chapter '${doc.chapter}' -> '${to}'`);
        });
        print(
          `[${collectionName}] DRY RUN: ${matching} document(s) would be updated to chapter '${to}'. Set CONFIRM='true' to apply.`,
        );
      } else {
        const result = collection.updateMany(filter, { $set: { chapter: to } });
        print(
          `[${collectionName}] Updated ${result.modifiedCount} document(s): chapter [${from.join(', ')}] -> '${to}'.`,
        );
      }
    });

    const deleteFilter = { documentType: 'CASE_APPOINTMENT', chapter: { $in: DELETE_CHAPTERS } };
    const matchingForDelete = collection.countDocuments(deleteFilter);

    print(
      `[${collectionName}] Found ${matchingForDelete} CASE_APPOINTMENT document(s) with chapter in [${DELETE_CHAPTERS.join(', ')}] (not valid in CAMS).`,
    );

    if (matchingForDelete === 0) {
      print(`[${collectionName}] Nothing to delete.`);
    } else if (DRY_RUN) {
      collection.find(deleteFilter).forEach(function (doc) {
        print(`  Would delete ${doc._id}: chapter '${doc.chapter}'`);
      });
      print(
        `[${collectionName}] DRY RUN: ${matchingForDelete} document(s) would be deleted. Set CONFIRM='true' to apply.`,
      );
    } else {
      const deleteResult = collection.deleteMany(deleteFilter);
      print(
        `[${collectionName}] Deleted ${deleteResult.deletedCount} document(s) with chapter 'AC'.`,
      );
    }
  });

  if (!DRY_RUN) {
    print('Migration complete.');
  }
})();
