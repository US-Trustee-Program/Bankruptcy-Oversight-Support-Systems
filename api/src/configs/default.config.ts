import dotenv from 'dotenv';
import { ServerType, AppConfig } from '../adapters/types/basic';
import dbConfig from './db.config';

dotenv.config();

const SERVER_HOSTNAME = process.env.SERVER_HOSTNAME || 'localhost';
const SERVER_PORT = process.env.SERVER_PORT || 8080;

const SERVER: ServerType = {
  hostname: SERVER_HOSTNAME,
  port: SERVER_PORT as number
};

let dbMock = Boolean(process.env.DATABASE_MOCK);

const config: AppConfig = {
  dbMock,
  dbConfig,
  server: SERVER
};

export default config;
