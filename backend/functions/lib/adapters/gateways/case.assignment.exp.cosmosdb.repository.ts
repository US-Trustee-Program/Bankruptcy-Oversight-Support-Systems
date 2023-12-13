import { CosmosClient } from '@azure/cosmos';
import { ApplicationContext } from '../types/basic';
import { DefaultAzureCredential, ManagedIdentityCredential } from '@azure/identity';
import log from '../services/logger.service';

export class CaseAssignmentExpCosmosDbRepository {
  private readonly dbEndpoint = process.env.COSMOS_ENDPOINT;
  private readonly managedId = process.env.COSMOS_MANAGED_IDENTITY;
  private readonly databaseName = process.env.COSMOS_DATABASE_NAME;

  private readonly ASSIGNMENT_CONTAINER = 'assignment';
  private readonly ASSIGNMENT_HISTORY_CONTAINER = 'assignmentHistory';

  private readonly applicationContext: ApplicationContext;
  private readonly cosmosDbClient: CosmosClient;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;

    try {
      this.applicationContext = applicationContext;
      this.cosmosDbClient = new CosmosClient({
        endpoint: this.dbEndpoint,
        aadCredentials: this.managedId
          ? new ManagedIdentityCredential({
              clientId: this.managedId,
            })
          : new DefaultAzureCredential(),
      });
    } catch (e) {
      log.error(this.applicationContext, 'CosmosDbExperimental', `${e.name}: ${e.message}`);
    }
  }

  async assignCase(caseId: string, users: User[]) {
    const currentTimestamp = new Date().toISOString();

    const assignment = new Assignment();
    assignment.id = caseId;
    assignment.caseId = caseId;
    assignment.timestamp = currentTimestamp;
    assignment.users = users;

    const assignmentContainer = this.cosmosDbClient
      .database(this.databaseName)
      .container(this.ASSIGNMENT_CONTAINER);
    assignmentContainer.items.upsert(assignment);

    const assignmentHistoryContainer = this.cosmosDbClient
      .database(this.databaseName)
      .container(this.ASSIGNMENT_HISTORY_CONTAINER);
    assignmentHistoryContainer.items.create(assignment);
  }

  async clearContainer() {
    const assignmentContainer = this.cosmosDbClient
      .database(this.databaseName)
      .container(this.ASSIGNMENT_CONTAINER);
    const { resources: results } = await assignmentContainer.items.readAll().fetchAll();
    if (results.length > 0) {
      for (const item of results) {
        assignmentContainer.item(item.id, item.caseId).delete();
      }
    }

    const assignmentHistoryContainer = this.cosmosDbClient
      .database(this.databaseName)
      .container(this.ASSIGNMENT_HISTORY_CONTAINER);
    const { resources: historyResults } = await assignmentHistoryContainer.items
      .readAll()
      .fetchAll();
    if (historyResults.length > 0) {
      for (const item of historyResults) {
        assignmentHistoryContainer.item(item.id, item.caseId).delete();
      }
    }
  }
}

export class Assignment {
  id: string;
  caseId: string;
  timestamp: string;
  users: User[];
}

export class User {
  name: string;
  role: string;
}
