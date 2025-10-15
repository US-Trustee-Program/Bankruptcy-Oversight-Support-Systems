import '@testing-library/jest-dom';
import dotenv from 'dotenv';

dotenv.config();
const camsConfiguration: Record<string, string> = {};

Object.keys(process.env)
  .filter((key) => key.startsWith('CAMS_'))
  .forEach((varName) => {
    if (process.env[varName] !== undefined) {
      camsConfiguration[varName] = process.env[varName];
    }
  });

camsConfiguration.CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING = '';
camsConfiguration.CAMS_DISABLE_LOCAL_CACHE = 'false';

window.CAMS_CONFIGURATION = camsConfiguration;
