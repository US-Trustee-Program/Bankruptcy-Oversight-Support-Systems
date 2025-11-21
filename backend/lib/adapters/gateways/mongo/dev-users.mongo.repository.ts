import { ApplicationContext } from '../../types/basic';
import { DocumentClient } from '../../../humble-objects/mongo-humble';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { DevUser } from '../dev-oauth2/dev-oauth2-gateway';

const MODULE_NAME = 'DEV-USERS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'users';
const DATABASE_NAME = 'dev-users';

export type DevUserDocument = DevUser & {
  documentType: 'DEV_USER';
};

export class DevUsersMongoRepository {
  private static referenceCount: number = 0;
  private static instance: DevUsersMongoRepository;
  protected readonly moduleName: string = MODULE_NAME;
  protected readonly collectionName: string = COLLECTION_NAME;
  protected readonly databaseName: string = DATABASE_NAME;
  protected readonly client: DocumentClient;

  constructor(context: ApplicationContext) {
    const { connectionString } = context.config.documentDbConfig;
    this.client = new DocumentClient(connectionString);
  }

  protected getAdapter<T>() {
    return MongoCollectionAdapter.newAdapter<T>(
      this.moduleName,
      this.collectionName,
      this.databaseName,
      this.client,
    );
  }

  public static getInstance(context: ApplicationContext) {
    if (!DevUsersMongoRepository.instance) {
      DevUsersMongoRepository.instance = new DevUsersMongoRepository(context);
    }
    DevUsersMongoRepository.referenceCount++;
    return DevUsersMongoRepository.instance;
  }

  public static dropInstance() {
    if (DevUsersMongoRepository.referenceCount > 0) {
      DevUsersMongoRepository.referenceCount--;
    }
    if (DevUsersMongoRepository.referenceCount < 1) {
      DevUsersMongoRepository.instance?.client.close().then();
      DevUsersMongoRepository.instance = null;
    }
  }

  public release() {
    DevUsersMongoRepository.dropInstance();
  }

  async getAllUsers(_context?: ApplicationContext): Promise<DevUser[]> {
    try {
      // Get all users from the collection (no filter)
      const users = await this.getAdapter<DevUser>().getAll();

      console.log(`${MODULE_NAME}: Loaded ${users.length} users from MongoDB dev-users database.`);

      return users;
    } catch (originalError) {
      console.error(
        `${MODULE_NAME}: Failed to load users from MongoDB: ${originalError.message}. Using empty user database.`,
      );
      return [];
    }
  }
}
