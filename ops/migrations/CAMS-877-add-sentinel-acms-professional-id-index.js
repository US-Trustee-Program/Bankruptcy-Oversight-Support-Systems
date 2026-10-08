/**
 * Create the `acmsProfessionalId_1` index on the `trustee-case-appointments` collection.
 *
 * This manual run is how the index reaches each environment. The index is listed in
 * ops/cloud-deployment/lib/cosmos/mongo/index-trustee-case-appointments.js, but CI does not run
 * that script (az-cosmos-deploy.sh's applyTrusteeCaseAppointmentsIndex guard is hardcoded false),
 * and Bicep cannot own it: trusteeCaseAppointmentsCollection omits `indexes` because a present
 * array would replace every index, including the mixed-direction sort index Bicep cannot express.
 *
 * Supports findSentinelAppointmentsByAcmsProfessionalId (see
 * backend/lib/adapters/gateways/mongo/trustee-case-appointments.mongo.repository.ts). Every
 * sentinel row shares one trusteeId, so without this index each per-professional-ID lookup scans
 * the whole sentinel logical partition.
 *
 * Do not start heal-sentinel-case-appointments until the index build has finished. Cosmos builds
 * the index in the background after createIndex returns, and db.currentOp does not report it. Run
 * a per-ID sentinel query, then read its cost:
 *   db.getCollection('trustee-case-appointments')
 *     .find({ trusteeId: '00000000-0000-0000-0000-000000000000', acmsProfessionalId: '<id>' })
 *     .toArray();
 *   db.runCommand({ getLastRequestStatistics: 1 });
 * RequestCharge falls from a full scan of the sentinel partition to a cost proportional to the
 * matches once the build finishes. Wait until it drops and holds.
 *
 * Idempotent and safe to re-run: an index that already exists is left alone.
 *
 * Usage: `load()` is not available in MongoDB Compass's embedded shell
 * (it returns a [COMMON-90002] error). Open this file, copy its contents,
 * and paste them directly into an interactive mongosh-compatible shell
 * (e.g. Compass's shell) connected to the target database. Run it against
 * both the main database and the e2e database.
 */

(function () {
  const collectionName = 'trustee-case-appointments';
  const indexName = 'acmsProfessionalId_1';
  const indexKey = { acmsProfessionalId: 1 };

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

  print(
    `Index '${indexName}' created on '${collectionName}'. Wait for the background build to finish before starting a heal run.`,
  );
})();
