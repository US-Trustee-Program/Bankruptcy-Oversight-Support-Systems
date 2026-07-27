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
 * Uses update-with-aggregation-pipeline syntax (updateMany with a pipeline
 * array) to remap '7A'/'7N'/'09' in a single pass instead of one updateMany
 * per rename group — meaningful at 3M+ documents. This requires MongoDB 4.2+;
 * this project's Cosmos DB Mongo API accounts are provisioned at server
 * version 7.0 (ops/cloud-deployment/lib/cosmos/mongo/cosmos-account.bicep),
 * uniformly across environments including Azure Government, so this is
 * well within range. The script prints the connected server's reported
 * version before running so this is verifiable at run time rather than
 * assumed.
 *
 * Usage: `load()` is not available in MongoDB Compass's embedded shell
 * (it returns a [COMMON-90002] error). Open this file, copy its contents,
 * and paste them directly into an interactive mongosh-compatible shell
 * (e.g. Compass's shell) connected to the target database.
 */

(function () {
  print(`Connected server reports Mongo API version: ${db.version()}`);

  const COLLECTIONS = ['case-trustee-appointments', 'trustee-case-appointments'];
  const RENAME_CHAPTERS = ['7A', '7N', '09'];
  const DELETE_CHAPTERS = ['AC'];

  COLLECTIONS.forEach((collectionName) => {
    const collection = db.getCollection(collectionName);

    const renameFilter = {
      documentType: 'CASE_APPOINTMENT',
      chapter: { $in: RENAME_CHAPTERS },
    };
    const matchingForRename = collection.countDocuments(renameFilter);

    print(
      `[${collectionName}] Found ${matchingForRename} CASE_APPOINTMENT document(s) with chapter in [${RENAME_CHAPTERS.join(', ')}].`,
    );

    if (matchingForRename === 0) {
      print(`[${collectionName}] Nothing to rename.`);
    } else {
      const renameResult = collection.updateMany(renameFilter, [
        {
          $set: {
            chapter: {
              $switch: {
                branches: [
                  { case: { $in: ['$chapter', ['7A', '7N']] }, then: '7' },
                  { case: { $eq: ['$chapter', '09'] }, then: '9' },
                ],
                default: '$chapter',
              },
            },
          },
        },
      ]);
      print(
        `[${collectionName}] Updated ${renameResult.modifiedCount} document(s): '7A'/'7N' -> '7', '09' -> '9'.`,
      );
    }

    const deleteFilter = { documentType: 'CASE_APPOINTMENT', chapter: { $in: DELETE_CHAPTERS } };
    const matchingForDelete = collection.countDocuments(deleteFilter);

    print(
      `[${collectionName}] Found ${matchingForDelete} CASE_APPOINTMENT document(s) with chapter in [${DELETE_CHAPTERS.join(', ')}] (not valid in CAMS).`,
    );

    if (matchingForDelete === 0) {
      print(`[${collectionName}] Nothing to delete.`);
    } else {
      const deleteResult = collection.deleteMany(deleteFilter);
      print(
        `[${collectionName}] Deleted ${deleteResult.deletedCount} document(s) with chapter 'AC'.`,
      );
    }
  });

  print('Migration complete.');
})();
