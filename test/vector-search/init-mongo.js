// MongoDB initialization script for vector search testing
// This runs when the container first starts
/* global db, print */

// eslint-disable-next-line no-global-assign
db = db.getSiblingDB('cams-local');

// Create cases collection if it doesn't exist
db.createCollection('cases');

print('Database "cams-local" initialized with cases collection');
