function createTempTable() {
  // ACMS
  // create ##caseIdsToMigrate
  // return row count from ##caseIdsToMigrate
}

/**
 *
 * We use strings because we have to deal with BigInt on the SQL server.
 *
 * @param offset
 * @param limit
 */
function getCaseIds(_offset: string, _limit: string) {
  // ACMS
  // page through the ##caseIdsToMigrate table
}

function dropTempTable() {
  // ACMS
  // drop ##caseIdsToMigrate
}

const MigrateCases = {
  createTempTable,
  getCaseIds,
  dropTempTable,
};

export default MigrateCases;
