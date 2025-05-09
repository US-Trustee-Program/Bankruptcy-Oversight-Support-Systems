import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const localConfigurationJsonPath = './public/configuration.json';

try {
  // Create an object to store configuration values
  const configObject = {};

  // Copy environment variables to the config object
  Object.keys(process.env)
    .filter((key) => key.startsWith('CAMS_'))
    .forEach((varName) => {
      if (process.env[varName] !== undefined) {
        configObject[varName] = process.env[varName];
      }
    });

  // Convert the config object to JSON
  const configJson = JSON.stringify(configObject, null, 2);

  // Open the file for writing
  fs.writeFileSync(localConfigurationJsonPath, configJson, 'utf8');
  console.log(`Configuration written to ${localConfigurationJsonPath}`);
} catch (error) {
  console.error(`Error writing configuration file: ${error.message}`);
  process.exit(1);
}
