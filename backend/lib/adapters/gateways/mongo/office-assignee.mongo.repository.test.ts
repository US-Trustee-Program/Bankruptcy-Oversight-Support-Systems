import { randomUUID } from 'crypto';
// import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
// import { getCamsError } from '../../../common-errors/error-utilities';
import { closeDeferred } from '../../../deferrable/defer-close';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { OfficeAssigneeMongoRepository } from './office-assignee.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';

describe('case assignment repo tests', () => {
  let context: ApplicationContext;
  let repo: OfficeAssigneeMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = OfficeAssigneeMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
    repo.release();
  });

  test('search should call Mongo find', async () => {
    //TODO: Create MockData function for officeAssignees
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
  });
  test('deleteMany should call mongo deleteMmany', () => {
    jest.spyOn(MongoCollectionAdapter.prototype, 'deleteMany').mockResolvedValue(3);
  });
  test('create should call mongo insertOne', () => {
    const mockId = randomUUID();
    jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue(mockId);
  });
});
