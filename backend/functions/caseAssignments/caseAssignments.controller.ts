import log from '../lib/adapters/services/logger.service';
import { DefaultAzureCredential } from "@azure/identity";
import { CosmosClient } from "@azure/cosmos";
import * as dotenv from 'dotenv';
dotenv.config();

const NAMESPACE = 'CASE-ASSIGNMENTS-CONTROLLER';

export class CaseAssignmentsController {

    private readonly logger: log
    private readonly cosmoDbClient: CosmosClient
    private readonly databaseName = process.env.COSMOS_DATABASE_NAME;

    constructor(logger: log) {
        this.logger = logger

        // reference documentation for client
        // https://learn.microsoft.com/en-us/javascript/api/overview/azure/cosmos-readme?view=azure-node-latest
        // https://github.com/Azure/azure-sdk-for-js/tree/%40azure/cosmos_3.17.3/sdk/cosmosdb/cosmos/samples/v3
        // Authenticate to Azure CosmosDb and create client
        let dbEndpoint = process.env.COSMOS_ENDPOINT;
        let managedId = process.env.COSMOS_MANAGED_IDENTITY;
        this.cosmoDbClient = new CosmosClient({
            endpoint: dbEndpoint,
            aadCredentials: new DefaultAzureCredential({
                managedIdentityClientId: managedId
            }
            )
        });
    }

    public async getCase(caseId) {
        this.logger.info(NAMESPACE, `invoking getCase id:${caseId}`)

        const containerName = "case"
        const containerKeyName = "caseId"
        const querySpec = {
            query: `SELECT * FROM c WHERE  c.${containerKeyName} = @caseId`,
            parameters: [
              {
                name: "@caseId",
                value: caseId
              }
            ]
          };

          this.logger.debug(NAMESPACE, querySpec.query)

          const { resources: results } = !caseId ?
            await this.cosmoDbClient.database(this.databaseName).container(containerName).items.readAll().fetchAll() :
            await this.cosmoDbClient.database(this.databaseName).container(containerName).items.query(querySpec).fetchAll()

        this.logger.info(NAMESPACE, `Query ${containerName} found ${results.length} results`)
        return results;
    }

    public async getAttorney(attorneyId) {
        this.logger.info(NAMESPACE, `invoking getAttorney id:${attorneyId}`)

        const containerName = "attorney"
        const containerKeyName = "attorneyId"
        const querySpec = {
            query: `SELECT * FROM ${containerName} c WHERE  c.${containerKeyName} = @attorneyId`,
            parameters: [
              {
                name: "@attorneyId",
                value: attorneyId
              }
            ]
          };

          const { resources: results } = !attorneyId ?
            await this.cosmoDbClient.database(this.databaseName).container(containerName).items.readAll().fetchAll() :
            await this.cosmoDbClient.database(this.databaseName).container(containerName).items.query(querySpec).fetchAll()

        this.logger.info(NAMESPACE, `Query ${containerName} found ${results.length} results`)
        return results;
    }
}
