import { DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

interface Assignment {
  caseId: string;
  name: string;
  role: number;
  id: string;
}

const getAllQuery = 'SELECT * FROM c';

const COSMOS_ENDPOINT = 'https://cosmos-ustp-cams.documents.azure.us:443/';
const COSMOS_DATABASE_NAME = 'cams';
const COSMOS_CONTAINER_NAME = 'assignments';

const options = {
  endpoint: COSMOS_ENDPOINT,
  aadCredentials: new DefaultAzureCredential(),
};
const client = new CosmosClient(options);

client
  .database(COSMOS_DATABASE_NAME)
  .container(COSMOS_CONTAINER_NAME)
  .items.query(getAllQuery)
  .fetchAll()
  .then((response) => {
    const assignments = response.resources as Assignment[];
    assignments.forEach((assignment) => {
      console.log('Deleting assignment id:', assignment.id, ' for case number:', assignment.caseId);
      client
        .database(COSMOS_DATABASE_NAME)
        .container(COSMOS_CONTAINER_NAME)
        .item(assignment.id, assignment.caseId)
        .delete();
    });
  });
