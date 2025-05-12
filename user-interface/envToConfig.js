const fs = require('fs');
const dotenv = require('dotenv');
const { parseArgs } = require('util');
dotenv.config();

const { configFileName } = parseArgs({
  options: {
    configFileName: {
      type: 'string',
      short: 'f',
      default: 'configuration.json',
    },
  },
}).values;

const localConfigurationJsonPath = `./public/${configFileName}`;

try {
  const configObject = {};

  Object.keys(process.env)
    .filter((key) => key.startsWith('CAMS_'))
    .forEach((varName) => {
      if (process.env[varName] !== undefined) {
        configObject[varName] = process.env[varName];
      }
    });

  const configJson = JSON.stringify(configObject, null, 2);

  fs.writeFileSync(localConfigurationJsonPath, configJson, 'utf8');
  console.log(`Configuration written to ${localConfigurationJsonPath}`);
} catch (error) {
  console.error(`Error writing configuration file: ${error.message}`);
  process.exit(1);
}
