import * as dotenv from 'dotenv';
import { ServerType, AppConfig } from '../adapters/types/basic';
import dbConfig from './db.config';

dotenv.config();

const SERVER_HOSTNAME = process.env.SERVER_HOSTNAME || 'localhost';
const SERVER_PORT = process.env.SERVER_PORT || 8080;

const SERVER: ServerType = {
  hostname: SERVER_HOSTNAME,
  port: SERVER_PORT as number,
};

let dbMock = process.env.DATABASE_MOCK?.toLowerCase() === 'true';
let pacerMock= process.env.PACER_MOCK?.toLowerCase() === 'true';

const config: AppConfig = {
  dbMock,
  dbConfig,
  pacerMock,
  server: SERVER,
  get: (prop: string) => {
    if (config.hasOwnProperty(prop)) {
      return config[prop];
    }
  }
};


export default config;
