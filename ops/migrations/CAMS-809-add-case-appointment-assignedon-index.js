/**
 * One-time bridge: create the `caseId_1_assignedOn_1` compound index on the
 * `case-trustee-appointments` collection, ahead of the next Cosmos deploy.
 *
 * Bicep is authoritative for this index (see
 * ops/cloud-deployment/lib/cosmos/mongo/cosmos-collections.bicep,
 * caseTrusteeAppointmentsCollection's `indexes` array) -- both keys are
 * ascending, so it is fully expressible in ARM and requires no out-of-band
 * management. This script exists ONLY so environments already deployed before
 * this change get the index without waiting for their next Cosmos deploy to
 * apply the updated Bicep. It is not a second owner of the index and is not
 * part of any recurring deploy step.
 *
 * DELETE THIS FILE once every environment has redeployed past this change --
 * at that point Bicep alone has already created and will keep reconciling
 * this index, and this script no longer serves any purpose.
 *
 * Supports getActiveByCaseId's query (see
 * backend/lib/adapters/gateways/mongo/trustee-case-appointments.mongo.repository.ts):
 * caseId equality (the shard key) narrows to one physical partition, and
 * assignedOn as the compound suffix lets Cosmos return the
 * ORDER BY assignedOn DESC / limit 1 result directly from the index instead of
 * fetching every active appointment for the case and sorting in memory.
 *
 * Idempotent and safe to re-run: createIndex on an index that already exists
 * in the same form is a no-op (confirmed via this script's own pre/post
 * indexExists check, following the verification convention used by
 * ops/cloud-deployment/lib/cosmos/mongo/index-trustee-case-appointments.js).
 *
 * Usage: `load()` is not available in MongoDB Compass's embedded shell
 * (it returns a [COMMON-90002] error). Open this file, copy its contents,
 * and paste them directly into an interactive mongosh-compatible shell
 * (e.g. Compass's shell) connected to the target database.
 */

(function () {
  const collectionName = 'case-trustee-appointments';
  const indexName = 'caseId_1_assignedOn_1';
  const indexKey = { caseId: 1, assignedOn: 1 };

  const collection = db.getCollection(collectionName);

  const alreadyExists = collection.getIndexes().some((index) => index.name === indexName);
  if (alreadyExists) {
    print(`Index '${indexName}' already exists on '${collectionName}'. Nothing to do.`);
    return;
  }

  print(`Creating index '${indexName}' on '${collectionName}'...`);
  collection.createIndex(indexKey, { name: indexName });

  const created = collection.getIndexes().some((index) => index.name === indexName);
  if (!created) {
    throw new Error(
      `createIndex reported success but '${indexName}' is not present in getIndexes() -- investigate before relying on this index.`,
    );
  }

  print(`Index '${indexName}' created and confirmed present on '${collectionName}'.`);
})();
