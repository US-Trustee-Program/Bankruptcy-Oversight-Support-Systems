import { Transfer, TransferFrom, TransferTo } from '../../../../../common/src/cams/events';
import { DocumentClient } from '../../mongo-humble-objects/mongo-humble';
import { DocumentQuery } from './document-db.repository';

// const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CASES';

export class CasesCosmosMongoDbRepository {
  private documentClient: DocumentClient;
  // private containerName = 'cases';

  constructor(connectionString: string) {
    this.documentClient = new DocumentClient(connectionString);
  }

  async getTransfers(caseId: string): Promise<Array<TransferFrom | TransferTo>> {
    const query: DocumentQuery = {
      and: [{ documentType: { equals: '^TRANSFER_' } }, { caseId: { equals: caseId } }],
    };
    const collection = this.documentClient.database('cams').collection<Transfer>('cases');
    const result = await collection.find(query);
    const assignments: Transfer[] = [];

    for await (const doc of result) {
      assignments.push(doc);
    }

    return assignments;
    // const query = "SELECT * FROM c WHERE c.caseId = @caseId AND c.documentType LIKE 'TRANSFER_%'";
    // const querySpec = {
    //   query,
    //   parameters: [
    //     {
    //       name: '@caseId',
    //       value: caseId,
    //     },
    //   ],
    // };
    // const response = await this.queryData<TransferFrom | TransferTo>(context, querySpec);
    // return response;
  }

  //   async createTransferFrom(
  //     context: ApplicationContext,
  //     transferFrom: TransferFrom,
  //   ): Promise<TransferFrom> {
  //     return this.create<TransferFrom>(context, transferFrom);
  //   }

  //   async createTransferTo(
  //     context: ApplicationContext,
  //     transferOut: TransferTo,
  //   ): Promise<TransferTo> {
  //     return this.create<TransferTo>(context, transferOut);
  //   }

  //   async getConsolidation(
  //     context: ApplicationContext,
  //     caseId: string,
  //   ): Promise<Array<ConsolidationTo | ConsolidationFrom>> {
  //     const query =
  //       "SELECT * FROM c WHERE c.caseId = @caseId AND c.documentType LIKE 'CONSOLIDATION_%'";
  //     const querySpec = {
  //       query,
  //       parameters: [
  //         {
  //           name: '@caseId',
  //           value: caseId,
  //         },
  //       ],
  //     };
  //     const response = await this.queryData<ConsolidationTo | ConsolidationFrom>(context, querySpec);
  //     return response;
  //   }

  //   async createConsolidationTo(
  //     context: ApplicationContext,
  //     consolidationIn: ConsolidationTo,
  //   ): Promise<ConsolidationTo> {
  //     return this.create<ConsolidationTo>(context, consolidationIn);
  //   }

  //   async createConsolidationFrom(
  //     context: ApplicationContext,
  //     consolidationOut: ConsolidationFrom,
  //   ): Promise<ConsolidationFrom> {
  //     return this.create<ConsolidationFrom>(context, consolidationOut);
  //   }

  //   async getCaseHistory(context: ApplicationContext, caseId: string): Promise<CaseHistory[]> {
  //     const query =
  //       'SELECT * FROM c WHERE c.documentType LIKE "AUDIT_%" AND c.caseId = @caseId ORDER BY c.occurredAtTimestamp DESC';
  //     const querySpec = {
  //       query,
  //       parameters: [
  //         {
  //           name: '@caseId',
  //           value: caseId,
  //         },
  //       ],
  //     };
  //     const response = await this.queryData<CaseHistory>(context, querySpec);
  //     return response;
  //   }

  //   async createCaseHistory(context: ApplicationContext, history: CaseHistory): Promise<string> {
  //     try {
  //       const { resource } = await this.cosmosDbClient
  //         .database(this.cosmosConfig.databaseName)
  //         .container(this.containerName)
  //         .items.create(history);
  //       context.logger.debug(MODULE_NAME, `New history created ${resource.id}`);
  //       return resource.id;
  //     } catch (e) {
  //       context.logger.error(MODULE_NAME, `${e.status} : ${e.name} : ${e.message}`);
  //       throw new UnknownError(MODULE_NAME, {
  //         message:
  //           'Unable to create assignment history. Please try again later. If the problem persists, please contact USTP support.',
  //         originalError: e,
  //         status: 500,
  //       });
  //     }
  //   }

  //   private async create<T>(context: ApplicationContext, itemToCreate: T): Promise<T> {
  //     try {
  //       try {
  //         const { resource } = await this.cosmosDbClient
  //           .database(this.cosmosConfig.databaseName)
  //           .container(this.containerName)
  //           .items.create(itemToCreate);
  //         context.logger.info(MODULE_NAME, 'Created the following resource:', resource);
  //         return resource;
  //       } catch (e) {
  //         if (!isPreExistingDocumentError(e)) {
  //           context.logger.info(MODULE_NAME, 'Item already exists: ', itemToCreate);
  //           throw e;
  //         }
  //       }
  //     } catch (originalError) {
  //       context.logger.error(
  //         MODULE_NAME,
  //         `${originalError.status} : ${originalError.name} : ${originalError.message}`,
  //       );
  //       if (originalError instanceof AggregateAuthenticationError) {
  //         throw new ServerConfigError(MODULE_NAME, {
  //           message: 'Failed to authenticate to Azure',
  //           originalError,
  //         });
  //       } else {
  //         throw originalError;
  //       }
  //     }
  //   }

  //   private async queryData<T>(context: ApplicationContext, querySpec: object): Promise<T[]> {
  //     try {
  //       const { resources: results } = await this.cosmosDbClient
  //         .database(this.cosmosConfig.databaseName)
  //         .container(this.containerName)
  //         .items.query(querySpec)
  //         .fetchAll();
  //       return results;
  //     } catch (originalError) {
  //       context.logger.error(
  //         MODULE_NAME,
  //         `${originalError.status} : ${originalError.name} : ${originalError.message}`,
  //       );
  //       if (originalError instanceof AggregateAuthenticationError) {
  //         throw new ServerConfigError(MODULE_NAME, {
  //           message: 'Failed to authenticate to Azure',
  //           originalError: originalError,
  //         });
  //       } else {
  //         throw originalError;
  //       }
  //     }
  //   }
}
