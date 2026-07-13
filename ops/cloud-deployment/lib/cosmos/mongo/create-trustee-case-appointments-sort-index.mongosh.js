// Creates the mixed-direction sort index required by getCasesForTrustee's
// ORDER BY dateFiled DESC, caseId ASC query on the trustee-case-appointments
// collection.
//
// WHY THIS SCRIPT EXISTS (do not delete):
// Cosmos DB Mongo API's Bicep/ARM `keys` array only supports ascending index
// directions. A mixed-direction composite index — descending on one field,
// ascending on another — cannot be expressed in cosmos-collections.bicep and
// must be created out-of-band. See the NOTE comment on the
// trusteeCaseAppointmentsCollection resource in cosmos-collections.bicep.
//
// WHEN TO RUN:
// After every Bicep deploy that creates or recreates the trustee-case-appointments
// collection in a given environment (dev, staging, prod). This index does not
// survive a collection drop/recreate and Bicep will not restore it.
//
// HOW TO RUN:
//   1. Obtain a mongosh shell connected to the target Cosmos DB account —
//      via Azure Cloud Shell (mongosh is preinstalled) or a local mongosh
//      install, using the account's Mongo connection string:
//        az cosmosdb keys list --type connection-strings \
//          --name <account-name> --resource-group <resource-group>
//   2. mongosh "<connection-string>"
//   3. use <database-name>
//   4. load('create-trustee-case-appointments-sort-index.mongosh.js')
//      -- or paste the command below directly into the shell.
//
// VERIFY:
//   db['trustee-case-appointments'].getIndexes()
//   Confirm an entry with key { dateFiled: -1, caseId: 1 } is present.

/* eslint-disable no-undef -- `db` is a mongosh shell global, not a Node/browser global */
db['trustee-case-appointments'].createIndex(
  { dateFiled: -1, caseId: 1 },
  { name: 'dateFiled_-1_caseId_1' },
);
