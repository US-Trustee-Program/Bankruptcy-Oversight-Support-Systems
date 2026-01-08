import { vi } from 'vitest';
import { randomUUID } from 'crypto';
import { closeDeferred } from '../../../deferrable/defer-close';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { OfficeAssigneeMongoRepository } from './office-assignee.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import MockData from '@common/cams/test-utilities/mock-data';
import { OfficeAssignee } from '../../../use-cases/gateways.types';

describe('case assignment repo tests', () => {
  let context: ApplicationContext;
  let repo: OfficeAssigneeMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = OfficeAssigneeMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repo.release();
  });

  test('should return a list of OfficeAssignee', async () => {
    const assignees: OfficeAssignee[] = [
      {
        caseId: '',
        officeCode: '',
        userId: '',
        name: '',
      },
    ];
    const predicate = { caseId: '000-11-22222' };
    const find = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(assignees);

    const actual = await repo.search(predicate);

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        condition: 'EQUALS',
        leftOperand: { name: 'caseId' },
        rightOperand: '000-11-22222',
      }),
    );
    expect(actual).toEqual(assignees);
  });

  test('should return a unique list of CamsUserReference by officeCode', async () => {
    const assignees = MockData.buildArray(MockData.getCamsUserReference, 3);
    const aggregate = vi.spyOn(MongoCollectionAdapter.prototype, 'aggregate').mockResolvedValue(
      assignees.map((u) => {
        return { ...u, _id: u.id };
      }),
    );

    const officeCode = 'TEST-OFFICE';
    const actual = await repo.getDistinctAssigneesByOffice(officeCode);

    expect(aggregate).toHaveBeenCalledWith({
      stages: [
        {
          condition: 'EQUALS',
          leftOperand: { name: 'officeCode' },
          rightOperand: 'TEST-OFFICE',
          stage: 'MATCH',
        },
        {
          accumulators: [
            {
              accumulator: 'FIRST',
              as: { name: 'name' },
              field: { name: 'name' },
            },
          ],
          groupBy: [
            expect.objectContaining({
              name: 'userId',
              source: 'office-assignment',
            }),
          ],
          stage: 'GROUP',
        },
        {
          fields: [
            {
              direction: 'DESCENDING',
              field: { name: 'name' },
            },
          ],
          stage: 'SORT',
        },
      ],
    });
    expect(actual).toEqual(assignees);
  });

  test('should delete OfficeAssignee records', async () => {
    const deleteMany = vi
      .spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
      .mockResolvedValue(3);
    const predicate = { caseId: '000-11-22222' };

    await repo.deleteMany(predicate);

    expect(deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        condition: 'EQUALS',
        leftOperand: { name: 'caseId' },
        rightOperand: '000-11-22222',
      }),
    );
  });

  test('should insert an OfficeAssignee record', async () => {
    const mockId = randomUUID();
    const insertOne = vi
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(mockId);

    const assignee: OfficeAssignee = {
      caseId: '',
      officeCode: '',
      userId: '',
      name: '',
    };

    await repo.create(assignee);

    expect(insertOne).toHaveBeenCalledWith(assignee);
  });

  test('should translate a predicate into a query', () => {
    const officeCodeQuery = repo.toQuery({ officeCode: 'TEST' });
    expect(officeCodeQuery).toEqual({
      condition: 'EQUALS',
      leftOperand: {
        name: 'officeCode',
      },
      rightOperand: 'TEST',
    });

    const caseAndUserIdsQuery = repo.toQuery({ caseId: '000-11-22222', userId: 'testUserId' });
    expect(caseAndUserIdsQuery).toEqual({
      conjunction: 'AND',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: {
            name: 'userId',
          },
          rightOperand: 'testUserId',
        },
        {
          condition: 'EQUALS',
          leftOperand: {
            name: 'caseId',
          },
          rightOperand: '000-11-22222',
        },
      ],
    });

    const caseIdQuery = repo.toQuery({ caseId: '000-11-22222' });
    expect(caseIdQuery).toEqual({
      condition: 'EQUALS',
      leftOperand: {
        name: 'caseId',
      },
      rightOperand: '000-11-22222',
    });

    expect(() => repo.toQuery({})).toThrow('Invalid predicate');
  });
});
