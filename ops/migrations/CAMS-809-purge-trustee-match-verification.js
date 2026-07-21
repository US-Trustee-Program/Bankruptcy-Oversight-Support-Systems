/**
 * One-time migration: delete all documents from the `trustee-match-verification`
 * collection so the backfill process can repopulate it cleanly.
 *
 * This is intentionally destructive and should only be run when the team has
 * confirmed the backfill will immediately follow.
 *
 * Usage (mongosh):
 *   mongosh "<connection-string>" ops/migrations/CAMS-809-purge-trustee-match-verification.js
 *
 * Or from an existing mongosh session already connected to the target database:
 *   load('ops/migrations/CAMS-809-purge-trustee-match-verification.js')
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
