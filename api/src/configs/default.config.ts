import { ServerType, AppConfig } from '../adapters/types/basic';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_HOSTNAME = process.env.SERVER_HOSTNAME || 'localhost';
const SERVER_PORT = process.env.SERVER_PORT || 8080;

const SERVER: ServerType = {
  hostname: SERVER_HOSTNAME,
  port: SERVER_PORT as number
};

let dbMock = Boolean(process.env.DATABASE_MOCK);
let dbConfig = {};

// dynamically load Database config if we are not in mock mode
if (!dbMock) {
  import('./db.config').then((db) => {
    dbConfig = db;
  });
}

const config: AppConfig = {
  dbMock,
  dbConfig,
  server: SERVER
};

export default config;
