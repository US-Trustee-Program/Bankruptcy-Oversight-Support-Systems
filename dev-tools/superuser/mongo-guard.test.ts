import { describe, test, expect } from 'vitest';
import { assertAllowedMongo } from './mongo-guard.js';

describe('assertAllowedMongo', () => {
  describe('without a Cosmos host (local only)', () => {
    test.each([
      { uri: 'mongodb://localhost:27017/cams', hosts: ['localhost'] },
      { uri: 'mongodb://127.0.0.1:27017', hosts: ['127.0.0.1'] },
      { uri: 'mongodb://[::1]:27017/cams?retrywrites=false', hosts: ['::1'] },
      { uri: 'mongodb://mongodb:27017/cams-e2e?retrywrites=false', hosts: ['mongodb'] },
      { uri: 'mongodb://LocalHost/cams', hosts: ['localhost'] },
      { uri: 'mongodb://user:p%40ss:word@localhost:27017/cams', hosts: ['localhost'] },
      {
        uri: 'mongodb://localhost:27017,127.0.0.1:27018/cams?replicaSet=rs0',
        hosts: ['localhost', '127.0.0.1'],
      },
    ])('should accept $uri', ({ uri, hosts }) => {
      expect(assertAllowedMongo(uri).hosts).toEqual(hosts);
    });

    test.each([
      {
        caseName: 'the Flexion dev Cosmos account',
        uri: 'mongodb://cosmos-mongo-ustp-cams-dev:key@cosmos-mongo-ustp-cams-dev.mongo.cosmos.azure.us:10255/?ssl=true', // pragma: allowlist secret
        refused: 'cosmos-mongo-ustp-cams-dev.mongo.cosmos.azure.us',
      },
      {
        caseName: 'the Flexion main Cosmos account',
        uri: 'mongodb://acct:key@cosmos-mongo-ustp-cams.mongo.cosmos.azure.us:10255/?ssl=true', // pragma: allowlist secret
        refused: 'cosmos-mongo-ustp-cams.mongo.cosmos.azure.us',
      },
      {
        caseName: 'a remote host hiding behind a local one in the host list',
        uri: 'mongodb://localhost:27017,db.example.com:27017/cams',
        refused: 'db.example.com',
      },
      {
        caseName: 'a host whose name only starts with localhost',
        uri: 'mongodb://localhost.example.com:27017/cams',
        refused: 'localhost.example.com',
      },
      {
        caseName: 'credentials that mention localhost for a remote host',
        uri: 'mongodb://localhost:secret@db.example.com/cams', // pragma: allowlist secret
        refused: 'db.example.com',
      },
      {
        caseName: 'another loopback-looking address',
        uri: 'mongodb://127.0.0.2/cams',
        refused: '127.0.0.2',
      },
    ])('should refuse $caseName, naming the host', ({ uri, refused }) => {
      expect(() => assertAllowedMongo(uri)).toThrow(refused);
    });

    test.each([
      {
        caseName: 'a mongodb+srv URI',
        uri: 'mongodb+srv://localhost/cams',
        message: 'mongodb+srv',
      },
      {
        caseName: 'a missing connection string',
        uri: undefined,
        message: 'MONGO_CONNECTION_STRING',
      },
      { caseName: 'a blank connection string', uri: '  ', message: 'MONGO_CONNECTION_STRING' },
      { caseName: 'another scheme', uri: 'https://localhost/cams', message: 'mongodb://' },
      { caseName: 'no host', uri: 'mongodb:///cams', message: 'no host' },
    ])('should refuse $caseName', ({ uri, message }) => {
      expect(() => assertAllowedMongo(uri)).toThrow(message);
    });
  });

  describe('with an explicit Cosmos host (pipeline mode)', () => {
    const cosmosHost = 'cosmos-ustp-cams.mongo.cosmos.azure.us';
    const uri = `mongodb://cosmos-ustp-cams:key%3D%3D@${cosmosHost}:10255/?ssl=true&replicaSet=globaldb`; // pragma: allowlist secret

    test('should accept a connection string for exactly that host', () => {
      expect(assertAllowedMongo(uri, { cosmosHost }).hosts).toEqual([cosmosHost]);
    });

    test('should match the host case-insensitively', () => {
      expect(assertAllowedMongo(uri, { cosmosHost: cosmosHost.toUpperCase() }).hosts).toEqual([
        cosmosHost,
      ]);
    });

    test.each([
      {
        caseName: 'a different Cosmos account',
        uri: 'mongodb://a:k@cosmos-mongo-ustp-cams-dev.mongo.cosmos.azure.us:10255/',
        refused: 'cosmos-mongo-ustp-cams-dev.mongo.cosmos.azure.us',
      },
      { caseName: 'a local Mongo', uri: 'mongodb://localhost:27017/cams', refused: 'localhost' },
    ])('should refuse $caseName, naming the host', ({ uri: other, refused }) => {
      expect(() => assertAllowedMongo(other, { cosmosHost })).toThrow(refused);
    });

    test('should still refuse mongodb+srv', () => {
      expect(() => assertAllowedMongo(`mongodb+srv://${cosmosHost}/`, { cosmosHost })).toThrow(
        'mongodb+srv',
      );
    });

    test('should refuse a blank Cosmos host', () => {
      expect(() => assertAllowedMongo(uri, { cosmosHost: ' ' })).toThrow('--cosmos-host');
    });
  });
});
