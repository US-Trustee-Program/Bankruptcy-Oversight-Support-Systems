import { ApplicationContext } from '../../types/basic';
import {
  TrusteeAppointmentsMongoRepository,
  TrusteeAppointmentDocument,
} from './trustee-appointments.mongo.repository';
import { TrusteeAppointment } from '../../../../../common/src/cams/trustee-appointments';
import { CamsUserReference } from '../../../../../common/src/cams/users';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';

describe('TrusteeAppointmentsMongoRepository', () => {
  let context: ApplicationContext;
  let repository: TrusteeAppointmentsMongoRepository;

  const mockUser: CamsUserReference = {
    id: 'user123',
    name: 'Test User',
  };

  const sampleAppointment: TrusteeAppointment = {
    id: 'appointment-1',
    trusteeId: 'trustee-1',
    chapter: '7-panel',
    courtId: '0208',
    divisionCode: '081',
    appointedDate: '2020-01-15T00:00:00Z',
    status: 'active',
    effectiveDate: '2020-01-15T00:00:00Z',
    createdOn: '2020-01-15T10:00:00Z',
    createdBy: mockUser,
    updatedOn: '2020-01-15T10:00:00Z',
    updatedBy: mockUser,
  };

  const sampleAppointmentDocument: TrusteeAppointmentDocument = {
    ...sampleAppointment,
    documentType: 'TRUSTEE_APPOINTMENT',
  };

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repository = new TrusteeAppointmentsMongoRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
    repository.release();
  });

  afterAll(() => {
    TrusteeAppointmentsMongoRepository.dropInstance();
  });

  describe('getInstance and dropInstance', () => {
    test('should return the same instance on multiple calls', async () => {
      const instance1 = TrusteeAppointmentsMongoRepository.getInstance(context);
      const instance2 = TrusteeAppointmentsMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);

      // Clean up
      instance1.release();
      instance2.release();
    });

    test('should manage reference count correctly', async () => {
      // Get multiple instances to increase reference count
      const instance1 = TrusteeAppointmentsMongoRepository.getInstance(context);
      const instance2 = TrusteeAppointmentsMongoRepository.getInstance(context);
      const instance3 = TrusteeAppointmentsMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);

      // First two releases should decrement count but keep instance
      instance1.release();
      instance2.release();

      // Instance should still exist
      const instance4 = TrusteeAppointmentsMongoRepository.getInstance(context);
      expect(instance4).toBe(instance1);

      // Clean up remaining references
      instance3.release();
      instance4.release();
    });
  });

  describe('read', () => {
    const expectedReadQuery = {
      conjunction: 'AND',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: { name: 'documentType' },
          rightOperand: 'TRUSTEE_APPOINTMENT',
        },
        {
          condition: 'EQUALS',
          leftOperand: { name: 'id' },
          rightOperand: 'appointment-1',
        },
      ],
    };

    test('should retrieve a trustee appointment by id successfully', async () => {
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(sampleAppointmentDocument);

      const result = await repository.read('appointment-1');

      expect(mockAdapter).toHaveBeenCalledWith(expectedReadQuery);
      expect(result.id).toBe('appointment-1');
      expect(result.trusteeId).toBe('trustee-1');
      expect(result.chapter).toBe('7-panel');
      expect(result.status).toBe('active');
    });

    test('should throw error when appointment not found', async () => {
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(null);

      await expect(repository.read('appointment-1')).rejects.toThrow(
        'Failed to retrieve trustee appointment with ID appointment-1.',
      );

      expect(mockAdapter).toHaveBeenCalledWith(expectedReadQuery);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockRejectedValue(error);

      await expect(repository.read('appointment-1')).rejects.toThrow();
      expect(mockAdapter).toHaveBeenCalledWith(expectedReadQuery);
    });
  });

  describe('getTrusteeAppointments', () => {
    const expectedGetTrusteeAppointmentsQuery = {
      conjunction: 'AND',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: { name: 'documentType' },
          rightOperand: 'TRUSTEE_APPOINTMENT',
        },
        {
          condition: 'EQUALS',
          leftOperand: { name: 'trusteeId' },
          rightOperand: 'trustee-1',
        },
      ],
    };

    test('should retrieve all appointments for a trustee successfully', async () => {
      const mockAppointments: TrusteeAppointmentDocument[] = [
        {
          ...sampleAppointment,
          id: 'appointment-1',
          chapter: '7-panel',
          divisionCode: '081',
          documentType: 'TRUSTEE_APPOINTMENT',
        },
        {
          ...sampleAppointment,
          id: 'appointment-2',
          chapter: '11',
          divisionCode: '087',
          documentType: 'TRUSTEE_APPOINTMENT',
        },
      ];

      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue(mockAppointments);

      const result = await repository.getTrusteeAppointments('trustee-1');

      expect(mockAdapter).toHaveBeenCalledWith(expectedGetTrusteeAppointmentsQuery);
      expect(result).toHaveLength(2);
      expect(result[0].chapter).toBe('7-panel');
      expect(result[1].chapter).toBe('11');
      expect(result[0].trusteeId).toBe('trustee-1');
      expect(result[1].trusteeId).toBe('trustee-1');
    });

    test('should return empty array when trustee has no appointments', async () => {
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue([]);

      const result = await repository.getTrusteeAppointments('trustee-1');

      expect(mockAdapter).toHaveBeenCalledWith(expectedGetTrusteeAppointmentsQuery);
      expect(result).toHaveLength(0);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockRejectedValue(error);

      await expect(repository.getTrusteeAppointments('trustee-1')).rejects.toThrow();
      expect(mockAdapter).toHaveBeenCalledWith(expectedGetTrusteeAppointmentsQuery);
    });
  });
});
