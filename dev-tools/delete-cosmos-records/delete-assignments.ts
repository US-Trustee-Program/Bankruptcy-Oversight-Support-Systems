import * as dotenv from 'dotenv';
import { DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

interface Assignment {
  caseId: string;
  name: string;
  role: number;
  id: string;
}

const getAllQuery = 'SELECT * FROM c';

export default function deleteAssignments() {
  dotenv.config();

  const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || '';
  const COSMOS_DATABASE_NAME = process.env.COSMOS_DATABASE_NAME || '';
  const COSMOS_CONTAINER_NAME = process.env.COSMOS_CONTAINER_NAME || '';

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
        console.log(
          'Deleting assignment id:',
          assignment.id,
          ' for case number:',
          assignment.caseId,
        );
        client
          .database(COSMOS_DATABASE_NAME)
          .container(COSMOS_CONTAINER_NAME)
          .item(assignment.id, assignment.caseId)
          .delete();
      });
    });
}
