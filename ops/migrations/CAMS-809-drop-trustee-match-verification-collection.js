/**
 * One-time migration: drop the `trustee-match-verification` collection entirely.
 *
 * Required before this deploy applies the collection's first-ever explicit
 * shardKey/unique-index declaration (ops/cloud-deployment/lib/cosmos/mongo/cosmos-collections.bicep).
 * Cosmos Mongo shard keys are immutable and unique indexes must exist at collection
 * creation time -- ARM cannot retroactively apply either to a collection that already
 * exists. Purging documents (CAMS-809-purge-trustee-match-verification.js) is not
 * enough; the collection itself must not exist so ARM creates it fresh with the new
 * shard key. Run this ONLY in an environment where `trustee-match-verification`
 * predates this deploy; a brand-new environment has no such collection to drop.
 *
 * This is intentionally destructive. Confirm the collection has already been
 * purged/backfilled as needed before running, and run immediately before the
 * deploy that adds the shardKey/unique-index declaration.
 *
 * Usage (mongosh):
 *   mongosh "<connection-string>" ops/migrations/CAMS-809-drop-trustee-match-verification-collection.js
 *
 * Or from an existing mongosh session already connected to the target database:
 *   load('ops/migrations/CAMS-809-drop-trustee-match-verification-collection.js')
 */

(function () {
  const collectionName = 'trustee-match-verification';

  const exists = db.getCollectionNames().includes(collectionName);
  if (!exists) {
    print(`Collection '${collectionName}' does not exist. Nothing to do.`);
    return;
  }

  const countBeforeDrop = db.getCollection(collectionName).countDocuments({});
  print(`Dropping '${collectionName}' collection (${countBeforeDrop} document(s) present)...`);

  db.getCollection(collectionName).drop();

  print(`Drop complete. Re-deploy to recreate '${collectionName}' with its shardKey and indexes.`);
})();
