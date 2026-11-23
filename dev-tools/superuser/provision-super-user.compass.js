// Gives one user an unscoped Super User permission (CAMS-940). Paste this whole file into the
// MONGOSH terminal of MongoDB Compass connected to the target Cosmos account. It uses only
// db.getSiblingDB, getCollection and UUID, which Compass's shell provides, and no require or load.
//
// Before pasting: set USER_ID (Okta user id), USER_NAME and USER_EMAIL below, and DATABASE if the
// environment's database is not 'cams'. Nothing checks the Okta 'USTP Cams Users' group, so a
// mistyped id writes a permission nobody can use.
//
// It writes the same two documents the Permissions screen writes: a USER_ROLE_ASSIGNMENT and a
// CREATED ROLE_ASSIGNMENT_AUDIT entry. Running it again changes nothing while the user holds an
// active Super User permission.
(() => {
  const USER_ID = 'REPLACE_WITH_OKTA_USER_ID';
  const USER_NAME = 'REPLACE_WITH_DISPLAY_NAME';
  const USER_EMAIL = '';
  const DATABASE = 'cams';

  if (USER_ID.startsWith('REPLACE') || USER_NAME.startsWith('REPLACE')) {
    throw new Error('Set USER_ID and USER_NAME first.');
  }
  if (!/^00u[A-Za-z0-9]{17}$/.test(USER_ID)) {
    throw new Error('USER_ID is not an Okta user id (00u + 17 characters).');
  }

  const database = db.getSiblingDB(DATABASE);
  const assignments = database.getCollection('user-role-assignments');
  const audits = database.getCollection('role-assignment-audit');
  const activeKey = 'SuperUser|*|*';

  const held = assignments.findOne({
    documentType: 'USER_ROLE_ASSIGNMENT',
    userId: USER_ID,
    activeKey: activeKey,
    active: true,
  });
  if (held) {
    print('already-held: ' + USER_ID + ' in ' + DATABASE + ' (' + held.id + ')');
    return;
  }

  const performer = { id: 'SUPERUSER_COMPASS_SCRIPT', name: 'Super User Compass script' };
  const performedAt = new Date().toISOString();
  const assignmentId = UUID().toHexString(true);
  const assignment = {
    documentType: 'USER_ROLE_ASSIGNMENT',
    id: assignmentId,
    userId: USER_ID,
    userName: USER_NAME,
    role: 'SuperUser',
    regionId: null,
    officeCode: null,
    assignedBy: performer.id,
    assignedByName: performer.name,
    assignedAt: performedAt,
    expiresAt: null,
    active: true,
    activeKey: activeKey,
  };
  if (USER_EMAIL) assignment.email = USER_EMAIL;

  assignments.insertOne(assignment);
  audits.insertOne({
    documentType: 'ROLE_ASSIGNMENT_AUDIT',
    id: UUID().toHexString(true),
    assignmentId: assignmentId,
    action: 'CREATED',
    userId: USER_ID,
    userName: USER_NAME,
    role: 'SuperUser',
    regionId: null,
    officeCode: null,
    performedBy: performer.id,
    performedByName: performer.name,
    performedAt: performedAt,
    previousState: null,
    newState: { role: 'SuperUser', regionId: null, officeCode: null, active: true },
    replacedByAssignmentId: null,
  });
  print('granted: ' + USER_ID + ' in ' + DATABASE + ' (' + assignmentId + ')');
})();
