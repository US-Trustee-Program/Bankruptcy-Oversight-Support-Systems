import { vi, describe, test, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { TrusteeAppointmentVerificationMongoRepository } from './trustee-appointment-verification.mongo.repository';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { AppointmentTaskKey } from '@common/cams/trustee-appointment-verification';
import { CamsUserReference } from '@common/cams/users';
import { TooManyRequestsError } from '../../../common-errors/too-many-requests-error';

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

  describe('openOrJoin', () => {
    test('upserts one document keyed by the tuple, adding the case to caseIds', async () => {
      const findOneAndUpdate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockResolvedValue(null);

      await repository.openOrJoin(key, 'case-1', 'no-appointment', user);

      expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(findOneAndUpdate).toHaveBeenCalledWith(
        expectedFilter,
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

      const [, update] = findOneAndUpdate.mock.calls[0];
      expect(update.$setOnInsert.createdOn).toEqual(update.$set.updatedOn);
    });

    test('retries once when a concurrent insert won the unique index', async () => {
      const findOneAndUpdate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockRejectedValueOnce(duplicateKeyError)
        .mockResolvedValueOnce(null);

      await expect(
        repository.openOrJoin(key, 'case-1', 'no-appointment', user),
      ).resolves.toBeUndefined();

      expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(findOneAndUpdate.mock.calls[1]).toEqual(findOneAndUpdate.mock.calls[0]);
    });

    test('throws when the retry also fails', async () => {
      const findOneAndUpdate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockRejectedValue(duplicateKeyError);

      await expect(repository.openOrJoin(key, 'case-1', 'no-appointment', user)).rejects.toThrow(
        'Failed to open or join trustee appointment task for trustee trustee-1',
      );
      expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    });

    test('rethrows a throttling error unchanged so callers can classify it as transient', async () => {
      const throttled = new TooManyRequestsError('TEST', { message: 'Throttled.' });
      const findOneAndUpdate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOneAndUpdate')
        .mockRejectedValue(throttled);

      await expect(repository.openOrJoin(key, 'case-1', 'no-appointment', user)).rejects.toBe(
        throttled,
      );
      expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    test('propagates a non-duplicate-key error without retrying', async () => {
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
