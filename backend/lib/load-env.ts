import * as dotenv from 'dotenv';
import * as path from 'path';

function loadEnv() {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

module.exports = { loadEnv };
