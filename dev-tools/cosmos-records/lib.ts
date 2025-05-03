import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import * as dotenv from 'dotenv';

interface DocumentWithId {
  caseId?: string;
  consolidationId?: string;
  id: string;
}

export function deleteDocuments(
  container: string,
  partitionKey: keyof DocumentWithId,
  query: string,
) {
  dotenv.config();

  const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || '';
  const COSMOS_DATABASE_NAME = process.env.COSMOS_DATABASE_NAME || '';
  const options = {
    aadCredentials: new DefaultAzureCredential(),
    endpoint: COSMOS_ENDPOINT,
  };

  const client = new CosmosClient(options);

  client
    .database(COSMOS_DATABASE_NAME)
    .container(container)
    .items.query(query)
    .fetchAll()
    .then((response) => {
      const docs = response.resources as DocumentWithId[];
      docs.forEach((doc) => {
        const partitionId = doc[partitionKey];
        client
          .database(COSMOS_DATABASE_NAME)
          .container(container)
          .item(doc.id, partitionId)
          .delete()
          .then(() => {
            console.log(`Deleting document id: ${doc.id} from ${container} container`);
          })
          .catch((e) => {
            if ('body' in e && 'code' in e.body) {
              console.error('doc id', doc.id, e.body.code);
            } else if ('message' in e) {
              console.error('doc id', doc.id, e.message);
            } else {
              console.error('doc id', doc.id, e);
            }
          });
      });
    });
}
