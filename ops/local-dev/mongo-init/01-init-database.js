// MongoDB initialization script for local development
// This script runs when the MongoDB container starts for the first time
// It creates the database and initial collections

db = db.getSiblingDB('cams');

// Create collections used by CAMS
const collections = [
  'cases',
  'orders',
  'consolidations',
  'case-assignments',
  'case-notes',
  'offices',
  'trustees',
  'trustee-appointments',
  'users',
  'user-sessions-cache',
  'user-groups',
  'office-assignees',
  'runtime-state',
  'lists'
];

collections.forEach(collectionName => {
  db.createCollection(collectionName);
  print(`Created collection: ${collectionName}`);
});

print('CAMS database and collections initialized successfully');
