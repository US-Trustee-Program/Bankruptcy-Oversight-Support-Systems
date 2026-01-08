// Send an http POST request to '{dataflows base url}/import/load-e2e-db'
// curl --location --request POST 'http://localhost:7072/import/load-e2e-db'

const endpoint = process.env.DATAFLOW_IMPORT_URL;
const adminKey = process.env.ADMIN_KEY;

if (!endpoint) {
  console.error('DATAFLOW_IMPORT_URL environment variable is not set.');
  process.exit(1);
}
if (!adminKey) {
  console.error('ADMIN_KEY environment variable is not set.');
  process.exit(1);
}

(async () => {
  try {
    console.log(
      `Seeding E2E database from endpoint '${endpoint}'.`,
      `Admin key exists? ${adminKey !== undefined}`,
    );
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `ApiKey ${adminKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
    console.log('E2E CosmosDB seeded successfully.');
  } catch (err) {
    console.error('Error seeding E2E CosmosDB:', err.message);
    process.exit(1);
  }
})();
