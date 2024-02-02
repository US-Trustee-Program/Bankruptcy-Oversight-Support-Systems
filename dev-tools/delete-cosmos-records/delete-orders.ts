import * as dotenv from 'dotenv';
import { DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

interface DocumentWithId {
  id: string;
  caseId: string;
}

const getAllOrdersQuery = 'SELECT * FROM c';
const getAllOrdersActionsInCasesQuery =
  "SELECT * FROM c WHERE c.documentType = 'TRANSFER_OUT' OR c.documentType = 'TRANSFER_IN'";

export default function deleteOrders() {
  dotenv.config();

  const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || '';
  const COSMOS_DATABASE_NAME = process.env.COSMOS_DATABASE_NAME || 'cams';
  const COSMOS_ORDERS_CONTAINER = 'orders';
  const COSMOS_CASES_CONTAINER = 'cases';

  const options = {
    endpoint: COSMOS_ENDPOINT,
    aadCredentials: new DefaultAzureCredential(),
  };
  const client = new CosmosClient(options);

  client
    .database(COSMOS_DATABASE_NAME)
    .container(COSMOS_ORDERS_CONTAINER)
    .items.query(getAllOrdersQuery)
    .fetchAll()
    .then((response) => {
      const docs = response.resources as DocumentWithId[];
      docs.forEach((doc) => {
        console.log('Deleting document id:', doc.id, 'from orders container');
        client
          .database(COSMOS_DATABASE_NAME)
          .container(COSMOS_ORDERS_CONTAINER)
          .item(doc.id, doc.caseId)
          .delete();
      });
    });

  client
    .database(COSMOS_DATABASE_NAME)
    .container(COSMOS_CASES_CONTAINER)
    .items.query(getAllOrdersActionsInCasesQuery)
    .fetchAll()
    .then((response) => {
      const docs = response.resources as DocumentWithId[];
      docs.forEach((doc) => {
        console.log('Deleting document id:', doc.id, 'from cases container');
        client
          .database(COSMOS_DATABASE_NAME)
          .container(COSMOS_CASES_CONTAINER)
          .item(doc.id, doc.caseId)
          .delete();
      });
    });
}

deleteOrders();
