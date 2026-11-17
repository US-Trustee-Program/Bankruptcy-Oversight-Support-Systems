import { vi, describe, test, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { TrusteeAppointmentVerificationMongoRepository } from './trustee-appointment-verification.mongo.repository';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { AppointmentTaskKey } from '@common/cams/trustee-appointment-verification';
import { CamsUserReference } from '@common/cams/users';
import { TooManyRequestsError } from '../../../common-errors/too-many-requests-error';
import { NotFoundError } from '../../../common-errors/not-found-error';

describe('TrusteeAppointmentVerificationMongoRepository', () => {
  let context: ApplicationContext;
  let repository: TrusteeAppointmentVerificationMongoRepository;

  const key: AppointmentTaskKey = {
    trusteeId: 'trustee-1',
    courtId: '081',
    divisionCode: '1',
    chapter: '7',
  };
  const user: CamsUserReference = { id: 'SYSTEM', name: 'SYSTEM' };

  const expectedFilter = {
    conjunction: 'AND',
    values: [
      {
        condition: 'EQUALS',
        leftOperand: { name: 'documentType' },
        rightOperand: 'TRUSTEE_APPOINTMENT_VERIFICATION',
      },
      { condition: 'EQUALS', leftOperand: { name: 'trusteeId' }, rightOperand: 'trustee-1' },
      { condition: 'EQUALS', leftOperand: { name: 'courtId' }, rightOperand: '081' },
      { condition: 'EQUALS', leftOperand: { name: 'divisionCode' }, rightOperand: '1' },
      { condition: 'EQUALS', leftOperand: { name: 'chapter' }, rightOperand: '7' },
    ],
  };

  const duplicateKeyError = new Error(
    'Failed to findOneAndUpdate. E11000 duplicate key error collection: cams.trustee-appointment-verification',
  );

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubEnv('MONGO_CONNECTION_STRING', 'mongodb://localhost:27017');
    context = await createMockApplicationContext();
    repository = new TrusteeAppointmentVerificationMongoRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.unstubAllEnvs();
    repository.release();
  });

  afterAll(() => {
    TrusteeAppointmentVerificationMongoRepository.dropInstance();
  });

  describe('getInstance and dropInstance', () => {
    test('should return the same instance until every reference is released', () => {
      const instance1 = TrusteeAppointmentVerificationMongoRepository.getInstance(context);
      const instance2 = TrusteeAppointmentVerificationMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);

      instance1.release();
      const instance3 = TrusteeAppointmentVerificationMongoRepository.getInstance(context);
      expect(instance3).toBe(instance2);

      instance2.release();
      instance3.release();
    });
  });

  describe('search', () => {
    test('finds appointment tasks with any of the given statuses', async () => {
      const task = { id: 'task-1', status: 'pending' };
      const find = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([task]);

      const result = await repository.search({ status: ['pending'] });

      expect(result).toEqual([task]);
      expect(find).toHaveBeenCalledWith({
        conjunction: 'AND',
        values: [
          {
            condition: 'EQUALS',
            leftOperand: { name: 'documentType' },
            rightOperand: 'TRUSTEE_APPOINTMENT_VERIFICATION',
          },
          { condition: 'CONTAINS', leftOperand: { name: 'status' }, rightOperand: ['pending'] },
        ],
      });
    });

    test('wraps a failed find', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(new Error('boom'));

      await expect(repository.search({ status: ['pending'] })).rejects.toThrow(
        'Failed to find trustee appointment tasks.',
      );
    });
  });

  describe('findById', () => {
    test('finds the task by id', async () => {
      const task = { id: 'task-1', trusteeId: 'trustee-1', status: 'pending' };
      const findOne = vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(task);

      const result = await repository.findById('task-1', 'trustee-1');

      expect(result).toEqual(task);
      expect(findOne).toHaveBeenCalledWith({
        conjunction: 'AND',
        values: [
          {
            condition: 'EQUALS',
            leftOperand: { name: 'documentType' },
            rightOperand: 'TRUSTEE_APPOINTMENT_VERIFICATION',
          },
          { condition: 'EQUALS', leftOperand: { name: 'trusteeId' }, rightOperand: 'trustee-1' },
          { condition: 'EQUALS', leftOperand: { name: 'id' }, rightOperand: 'task-1' },
        ],
      });
    });

    test('rethrows a not-found error unchanged', async () => {
      const notFound = new NotFoundError('TEST');
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(notFound);

      await expect(repository.findById('missing', 'trustee-1')).rejects.toBe(notFound);
    });

    test('wraps any other failure', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(new Error('boom'));

      await expect(repository.findById('task-1', 'trustee-1')).rejects.toThrow(
        'Failed to find trustee appointment task task-1.',
      );
    });
  });

  describe('resolve', () => {
    const expectedResolveFilter = {
      conjunction: 'AND',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: { name: 'documentType' },
          rightOperand: 'TRUSTEE_APPOINTMENT_VERIFICATION',
        },
        { condition: 'EQUALS', leftOperand: { name: 'trusteeId' }, rightOperand: 'trustee-1' },
        { condition: 'EQUALS', leftOperand: { name: 'id' }, rightOperand: 'task-1' },
        { condition: 'EQUALS', leftOperand: { name: 'status' }, rightOperand: 'pending' },
        {
          condition: 'EQUALS',
          leftOperand: { name: 'updatedOn' },
          rightOperand: '2026-11-02T00:00:00.000Z',
        },
      ],
    };

    test('approves the task, stamped with the resolving user, only if it is still pending and unchanged since it was read', async () => {
      const findOneAndUpdate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockResolvedValue({ id: 'task-1' });

      const resolved = await repository.resolve(
        'task-1',
        'trustee-1',
        '2026-11-02T00:00:00.000Z',
        user,
      );

      expect(resolved).toBe(true);
      expect(findOneAndUpdate).toHaveBeenCalledWith(expectedResolveFilter, {
        $set: { status: 'approved', updatedOn: expect.any(String), updatedBy: user },
      });
    });

    test('reports false when the task changed or is no longer pending', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate').mockResolvedValue(null);

      await expect(
        repository.resolve('task-1', 'trustee-1', '2026-11-02T00:00:00.000Z', user),
      ).resolves.toBe(false);
    });

    test('wraps any other failure', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate').mockRejectedValue(
        new Error('boom'),
      );

      await expect(
        repository.resolve('task-1', 'trustee-1', '2026-11-02T00:00:00.000Z', user),
      ).rejects.toThrow('Failed to resolve trustee appointment task task-1.');
    });
  });

  describe('openOrJoin', () => {
    const expectedPendingFilter = {
      ...expectedFilter,
      values: [
        ...expectedFilter.values,
        { condition: 'EQUALS', leftOperand: { name: 'status' }, rightOperand: 'pending' },
      ],
    };
    const expectedReopenFilter = {
      ...expectedFilter,
      values: [
        ...expectedFilter.values,
        { condition: 'NOT_EQUALS', leftOperand: { name: 'status' }, rightOperand: 'pending' },
      ],
    };

    // The reset must run BEFORE the upsert: if it ran after, a second concurrent joiner's reset
    // could overwrite caseIds and drop the first joiner's case.
    test('first resets a non-pending task for the tuple to pending with only the joining case', async () => {
      const findOneAndUpdate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockResolvedValue(null);

      await repository.openOrJoin(key, 'case-2', 'appointment-inactive', user);

      expect(findOneAndUpdate).toHaveBeenNthCalledWith(1, expectedReopenFilter, {
        $set: {
          status: 'pending',
          caseIds: ['case-2'],
          reason: 'appointment-inactive',
          updatedOn: expect.any(String),
          updatedBy: user,
        },
      });
    });

    test("upserts the tuple's pending task, adding the case to caseIds, so a join never lands on a resolved task", async () => {
      const findOneAndUpdate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockResolvedValue(null);

      await repository.openOrJoin(key, 'case-1', 'no-appointment', user);

      expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(findOneAndUpdate).toHaveBeenLastCalledWith(
        expectedPendingFilter,
        {
          $addToSet: { caseIds: 'case-1' },
          $set: { reason: 'no-appointment', updatedOn: expect.any(String), updatedBy: user },
          $setOnInsert: {
            id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            documentType: 'TRUSTEE_APPOINTMENT_VERIFICATION',
            trusteeId: 'trustee-1',
            courtId: '081',
            divisionCode: '1',
            chapter: '7',
            taskType: 'trustee-appointment',
            status: 'pending',
            createdOn: expect.any(String),
            createdBy: user,
          },
        },
        { upsert: true },
      );
    });

    test('stamps createdOn and updatedOn with the same write time', async () => {
      const findOneAndUpdate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockResolvedValue(null);

      await repository.openOrJoin(key, 'case-1', 'appointment-inactive', user);

      const [, reopen] = findOneAndUpdate.mock.calls[0];
      const [, update] = findOneAndUpdate.mock.calls[1];
      expect(update.$setOnInsert.createdOn).toEqual(update.$set.updatedOn);
      expect(reopen.$set.updatedOn).toEqual(update.$set.updatedOn);
    });

    // A duplicate key means the tuple's task exists but did not match the pending upsert: a
    // concurrent insert won, or a refresh resolved the task after this join's reopen. Retrying
    // from the reopen covers both.
    test('on a duplicate key, retries from the reopen so the case joins a pending task', async () => {
      const findOneAndUpdate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(duplicateKeyError)
        .mockResolvedValueOnce({ id: 'task-1' })
        .mockResolvedValueOnce(null);

      await expect(
        repository.openOrJoin(key, 'case-1', 'no-appointment', user),
      ).resolves.toBeUndefined();

      expect(findOneAndUpdate).toHaveBeenCalledTimes(4);
      expect(findOneAndUpdate.mock.calls[2]).toEqual(findOneAndUpdate.mock.calls[0]);
      expect(findOneAndUpdate.mock.calls[3]).toEqual(findOneAndUpdate.mock.calls[1]);
    });

    test('throws after three attempts that all hit a duplicate key', async () => {
      const findOneAndUpdate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockImplementation(async (_query, update) => {
          if ('$addToSet' in update) throw duplicateKeyError;
          return null;
        });

      await expect(repository.openOrJoin(key, 'case-1', 'no-appointment', user)).rejects.toThrow(
        'Failed to open or join trustee appointment task for trustee trustee-1',
      );
      expect(findOneAndUpdate).toHaveBeenCalledTimes(6);
    });

    test.each([
      { write: 'reopen', priorSuccesses: 0 },
      { write: 'upsert', priorSuccesses: 1 },
    ])(
      'rethrows a throttling error on the $write unchanged so callers can classify it as transient',
      async ({ priorSuccesses }) => {
        const throttled = new TooManyRequestsError('TEST', { message: 'Throttled.' });
        const findOneAndUpdate = vi.spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate');
        for (let i = 0; i < priorSuccesses; i++) findOneAndUpdate.mockResolvedValueOnce(null);
        findOneAndUpdate.mockRejectedValue(throttled);

        await expect(repository.openOrJoin(key, 'case-1', 'no-appointment', user)).rejects.toBe(
          throttled,
        );
        expect(findOneAndUpdate).toHaveBeenCalledTimes(priorSuccesses + 1);
      },
    );

    test('propagates a non-duplicate-key error without retrying', async () => {
      const findOneAndUpdate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockResolvedValueOnce(null)
        .mockRejectedValue(new Error('Write failed'));

      await expect(repository.openOrJoin(key, 'case-1', 'no-appointment', user)).rejects.toThrow(
        'Failed to open or join trustee appointment task for trustee trustee-1',
      );
      expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    });

    test('does not upsert when reopening a resolved task fails', async () => {
      const findOneAndUpdate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockRejectedValue(new Error('Write failed'));

      await expect(repository.openOrJoin(key, 'case-1', 'no-appointment', user)).rejects.toThrow(
        'Failed to open or join trustee appointment task for trustee trustee-1',
      );
      expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    });
  });
});
