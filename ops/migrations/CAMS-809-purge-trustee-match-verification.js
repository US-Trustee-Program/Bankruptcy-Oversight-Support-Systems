/**
 * One-time migration: delete all documents from the `trustee-match-verification`
 * collection so the backfill process can repopulate it cleanly.
 *
 * This is intentionally destructive and should only be run when the team has
 * confirmed the backfill will immediately follow.
 *
 * Usage: `load()` is not available in MongoDB Compass's embedded shell
 * (it returns a [COMMON-90002] error). Open this file, copy its contents,
 * and paste them directly into an interactive mongosh-compatible shell
 * (e.g. Compass's shell) connected to the target database.
 */

(function () {
  const collection = db.getCollection('trustee-match-verification');

  print("Purging all documents from 'trustee-match-verification' collection...");

  const result = collection.deleteMany({});

  if (result.deletedCount === 0) {
    print('Collection was already empty. Nothing to do.');
  } else {
    print(`Deleted ${result.deletedCount} document(s).`);
    print('Purge complete. Run the backfill to repopulate.');
  }
})();
