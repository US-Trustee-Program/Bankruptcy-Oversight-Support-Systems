import * as dotenv from 'dotenv';
import { DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

interface DocumentWithId {
  id: string;
  caseId: string;
}

const getAllQuery = 'SELECT * FROM c';

export default function deleteOrders() {
  dotenv.config();

  const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || '';
  const COSMOS_DATABASE_NAME = process.env.COSMOS_DATABASE_NAME || '';
  const COSMOS_CONTAINER_NAME = 'orders';

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
      const docs = response.resources as DocumentWithId[];
      docs.forEach((doc) => {
        console.log('Deleting document id:', doc.id);
        client
          .database(COSMOS_DATABASE_NAME)
          .container(COSMOS_CONTAINER_NAME)
          .item(doc.id, doc.caseId)
          .delete();
      });
    });
}

deleteOrders();
