import { vi } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import {
  TrusteeAppointmentsMongoRepository,
  TrusteeAppointmentDocument,
  CaseAppointmentDocument,
} from './trustee-appointments.mongo.repository';
import {
  CaseAppointment,
  TrusteeAppointment,
  TrusteeAppointmentInput,
} from '@common/cams/trustee-appointments';
import { CamsUserReference } from '@common/cams/users';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { NotFoundError } from '../../../common-errors/not-found-error';

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
    chapter: '7',
    appointmentType: 'panel',
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
    vi.restoreAllMocks();
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
        {
          condition: 'EQUALS',
          leftOperand: { name: 'trusteeId' },
          rightOperand: 'trustee-1',
        },
      ],
    };

    test('should retrieve a trustee appointment by id and trusteeId successfully', async () => {
      const mockAdapter = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(sampleAppointmentDocument);

      const result = await repository.read('trustee-1', 'appointment-1');

      expect(mockAdapter).toHaveBeenCalledWith(expectedReadQuery);
      expect(result.id).toBe('appointment-1');
      expect(result.trusteeId).toBe('trustee-1');
      expect(result.chapter).toBe('7');
      expect(result.appointmentType).toBe('panel');
      expect(result.status).toBe('active');
    });

    test('should throw error when appointment not found', async () => {
      const mockAdapter = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(null);

      await expect(repository.read('trustee-1', 'appointment-1')).rejects.toThrow(
        'Trustee appointment with ID appointment-1 not found.',
      );

      expect(mockAdapter).toHaveBeenCalledWith(expectedReadQuery);
    });

    test('should throw error when appointment does not belong to trustee', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(null);

      await expect(repository.read('wrong-trustee', 'appointment-1')).rejects.toThrow(
        'Trustee appointment with ID appointment-1 not found.',
      );
    });

    test('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(error);

      await expect(repository.read('trustee-1', 'appointment-1')).rejects.toThrow();
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
          chapter: '7',
          appointmentType: 'panel',
          divisionCode: '081',
          documentType: 'TRUSTEE_APPOINTMENT',
        },
        {
          ...sampleAppointment,
          id: 'appointment-2',
          chapter: '11',
          appointmentType: 'case-by-case',
          divisionCode: '087',
          documentType: 'TRUSTEE_APPOINTMENT',
        },
      ];

      const mockAdapter = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue(mockAppointments);

      const result = await repository.getTrusteeAppointments('trustee-1');

      expect(mockAdapter).toHaveBeenCalledWith(expectedGetTrusteeAppointmentsQuery);
      expect(result).toHaveLength(2);
      expect(result[0].chapter).toBe('7');
      expect(result[0].appointmentType).toBe('panel');
      expect(result[1].chapter).toBe('11');
      expect(result[1].appointmentType).toBe('case-by-case');
      expect(result[0].trusteeId).toBe('trustee-1');
      expect(result[1].trusteeId).toBe('trustee-1');
    });

    test('should return empty array when trustee has no appointments', async () => {
      const mockAdapter = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      const result = await repository.getTrusteeAppointments('trustee-1');

      expect(mockAdapter).toHaveBeenCalledWith(expectedGetTrusteeAppointmentsQuery);
      expect(result).toHaveLength(0);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      const mockAdapter = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockRejectedValue(error);

      await expect(repository.getTrusteeAppointments('trustee-1')).rejects.toThrow();
      expect(mockAdapter).toHaveBeenCalledWith(expectedGetTrusteeAppointmentsQuery);
    });
  });

  describe('createAppointment', () => {
    const trusteeId = 'trustee-123';
    const appointmentInput: TrusteeAppointmentInput = {
      chapter: '7',
      appointmentType: 'panel',
      courtId: '081',
      divisionCode: '1',
      appointedDate: '2024-01-15',
      status: 'active',
      effectiveDate: '2024-01-15T00:00:00.000Z',
    };

    test('should create a new appointment successfully', async () => {
      const mockId = 'new-appointment-id';
      const mockAdapter = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue(mockId);

      const result = await repository.createAppointment(trusteeId, appointmentInput, mockUser);

      expect(mockAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          trusteeId,
          chapter: appointmentInput.chapter,
          courtId: appointmentInput.courtId,
          divisionCode: appointmentInput.divisionCode,
          appointedDate: appointmentInput.appointedDate,
          status: appointmentInput.status,
          effectiveDate: appointmentInput.effectiveDate,
          documentType: 'TRUSTEE_APPOINTMENT',
          createdBy: mockUser,
          updatedBy: mockUser,
        }),
      );
      expect(result.id).toBe(mockId);
      expect(result.trusteeId).toBe(trusteeId);
      expect(result.chapter).toBe(appointmentInput.chapter);
    });

    test('should handle database errors during creation', async () => {
      const error = new Error('Database connection failed');
      const mockAdapter = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockRejectedValue(error);

      await expect(
        repository.createAppointment(trusteeId, appointmentInput, mockUser),
      ).rejects.toThrow(`Failed to create trustee appointment for trustee ${trusteeId}.`);

      expect(mockAdapter).toHaveBeenCalled();
    });
  });

  describe('updateAppointment', () => {
    const trusteeId = 'trustee-1';
    const appointmentId = 'appointment-1';
    const appointmentUpdate: TrusteeAppointmentInput = {
      chapter: '11',
      appointmentType: 'case-by-case',
      courtId: '081',
      divisionCode: '2',
      appointedDate: '2024-02-01',
      status: 'inactive',
      effectiveDate: '2024-02-15T00:00:00.000Z',
    };

    const expectedUpdateQuery = {
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
          rightOperand: appointmentId,
        },
        {
          condition: 'EQUALS',
          leftOperand: { name: 'trusteeId' },
          rightOperand: trusteeId,
        },
      ],
    };

    test('should update an appointment successfully', async () => {
      const mockFindOne = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(sampleAppointmentDocument);

      const mockReplaceOne = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue(undefined);

      const result = await repository.updateAppointment(
        trusteeId,
        appointmentId,
        appointmentUpdate,
        mockUser,
      );

      expect(mockFindOne).toHaveBeenCalledWith(expectedUpdateQuery);
      expect(mockReplaceOne).toHaveBeenCalledWith(
        expectedUpdateQuery,
        expect.objectContaining({
          id: appointmentId,
          chapter: appointmentUpdate.chapter,
          courtId: appointmentUpdate.courtId,
          divisionCode: appointmentUpdate.divisionCode,
          appointedDate: appointmentUpdate.appointedDate,
          status: appointmentUpdate.status,
          effectiveDate: appointmentUpdate.effectiveDate,
          documentType: 'TRUSTEE_APPOINTMENT',
          updatedBy: mockUser,
          updatedOn: expect.any(String),
          createdBy: sampleAppointmentDocument.createdBy,
          createdOn: sampleAppointmentDocument.createdOn,
        }),
      );

      expect(result.id).toBe(appointmentId);
      expect(result.chapter).toBe(appointmentUpdate.chapter);
      expect(result.status).toBe(appointmentUpdate.status);
      expect(result.updatedBy).toEqual(mockUser);
    });

    test('should throw error when appointment not found', async () => {
      const mockFindOne = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(null);

      await expect(
        repository.updateAppointment(trusteeId, appointmentId, appointmentUpdate, mockUser),
      ).rejects.toThrow(`Trustee appointment with ID ${appointmentId} not found.`);

      expect(mockFindOne).toHaveBeenCalledWith(expectedUpdateQuery);
    });

    test('should throw error when appointment does not belong to trustee', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(null);

      await expect(
        repository.updateAppointment('wrong-trustee', appointmentId, appointmentUpdate, mockUser),
      ).rejects.toThrow(`Trustee appointment with ID ${appointmentId} not found.`);
    });

    test('should handle database errors during update', async () => {
      const error = new Error('Database connection failed');
      const mockFindOne = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockRejectedValue(error);

      await expect(
        repository.updateAppointment(trusteeId, appointmentId, appointmentUpdate, mockUser),
      ).rejects.toThrow(`Failed to update trustee appointment with ID ${appointmentId}.`);

      expect(mockFindOne).toHaveBeenCalledWith(expectedUpdateQuery);
    });

    test('should preserve original createdBy and createdOn fields', async () => {
      const originalCreatedBy = { id: 'original-user', name: 'Original User' };
      const originalCreatedOn = '2023-01-01T00:00:00Z';
      const existingAppointment: TrusteeAppointmentDocument = {
        ...sampleAppointmentDocument,
        createdBy: originalCreatedBy,
        createdOn: originalCreatedOn,
      };

      const mockFindOne = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(existingAppointment);

      const mockReplaceOne = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue(undefined);

      const result = await repository.updateAppointment(
        trusteeId,
        appointmentId,
        appointmentUpdate,
        mockUser,
      );

      expect(mockFindOne).toHaveBeenCalledWith(expectedUpdateQuery);
      expect(mockReplaceOne).toHaveBeenCalledWith(
        expectedUpdateQuery,
        expect.objectContaining({
          createdBy: originalCreatedBy,
          createdOn: originalCreatedOn,
          updatedBy: mockUser,
        }),
      );

      expect(result.createdBy).toEqual(originalCreatedBy);
      expect(result.createdOn).toBe(originalCreatedOn);
      expect(result.updatedBy).toEqual(mockUser);
      expect(result.updatedOn).not.toBe(originalCreatedOn);
    });
  });

  describe('getActiveCaseAppointment', () => {
    const expectedQuery = {
      conjunction: 'AND',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: { name: 'documentType' },
          rightOperand: 'CASE_APPOINTMENT',
        },
        {
          condition: 'EQUALS',
          leftOperand: { name: 'caseId' },
          rightOperand: 'case-001',
        },
        {
          condition: 'EXISTS',
          leftOperand: { name: 'unassignedOn' },
          rightOperand: false,
        },
      ],
    };

    const sampleCaseAppointment: CaseAppointmentDocument = {
      id: 'ca-1',
      documentType: 'CASE_APPOINTMENT',
      caseId: 'case-001',
      trusteeId: 'trustee-1',
      assignedOn: '2024-01-15T00:00:00Z',
      createdOn: '2024-01-15T00:00:00Z',
      createdBy: mockUser,
      updatedOn: '2024-01-15T00:00:00Z',
      updatedBy: mockUser,
    };

    test('should return active case appointment when found', async () => {
      const mockFindOne = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(sampleCaseAppointment);

      const result = await repository.getActiveCaseAppointment('case-001');

      expect(mockFindOne).toHaveBeenCalledWith(expectedQuery);
      expect(result).toEqual(sampleCaseAppointment);
    });

    test('should return null when no active appointment exists (NotFoundError)', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new NotFoundError('TEST'),
      );

      const result = await repository.getActiveCaseAppointment('case-001');

      expect(result).toBeNull();
    });

    test('should throw on database errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(repository.getActiveCaseAppointment('case-001')).rejects.toThrow(
        'Failed to retrieve active case appointment for case case-001.',
      );
    });
  });

  describe('createCaseAppointment', () => {
    const newCaseAppointment: CaseAppointment = {
      id: 'ca-new',
      caseId: 'case-001',
      trusteeId: 'trustee-1',
      assignedOn: '2024-01-15T00:00:00Z',
      updatedOn: '2024-01-15T00:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
      createdOn: '2024-01-15T00:00:00Z',
      createdBy: SYSTEM_USER_REFERENCE,
    };

    test('should create a new case appointment', async () => {
      const mockId = 'new-case-appointment-id';
      const mockInsertOne = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue(mockId);

      const result = await repository.createCaseAppointment(newCaseAppointment);

      expect(mockInsertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'CASE_APPOINTMENT',
          caseId: 'case-001',
          trusteeId: 'trustee-1',
          assignedOn: '2024-01-15T00:00:00Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedBy: SYSTEM_USER_REFERENCE,
        }),
      );
      expect(result.id).toBe(mockId);
      expect(result.caseId).toBe('case-001');
      expect(result.trusteeId).toBe('trustee-1');
    });

    test('should throw on database errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(repository.createCaseAppointment(newCaseAppointment)).rejects.toThrow(
        'Failed to create case appointment for case case-001.',
      );
    });
  });

  describe('updateCaseAppointment', () => {
    const existingAppointment: CaseAppointment = {
      id: 'ca-1',
      caseId: 'case-001',
      trusteeId: 'trustee-1',
      assignedOn: '2024-01-15T00:00:00Z',
      createdOn: '2024-01-15T00:00:00Z',
      createdBy: mockUser,
      updatedOn: '2024-01-15T00:00:00Z',
      updatedBy: mockUser,
    };

    const expectedUpdateQuery = {
      conjunction: 'AND',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: { name: 'documentType' },
          rightOperand: 'CASE_APPOINTMENT',
        },
        {
          condition: 'EQUALS',
          leftOperand: { name: 'id' },
          rightOperand: 'ca-1',
        },
      ],
    };

    test('should update a case appointment with unassignedOn', async () => {
      const mockReplaceOne = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue(undefined);

      const appointmentToClose = {
        ...existingAppointment,
        unassignedOn: '2024-06-01T00:00:00Z',
      };

      const result = await repository.updateCaseAppointment(appointmentToClose);

      expect(mockReplaceOne).toHaveBeenCalledWith(
        expectedUpdateQuery,
        expect.objectContaining({
          documentType: 'CASE_APPOINTMENT',
          id: 'ca-1',
          unassignedOn: '2024-06-01T00:00:00Z',
          updatedBy: SYSTEM_USER_REFERENCE,
          updatedOn: expect.any(String),
        }),
      );
      expect(result.unassignedOn).toBe('2024-06-01T00:00:00Z');
      expect(result.updatedBy).toEqual(SYSTEM_USER_REFERENCE);
    });

    test('should throw on database errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(repository.updateCaseAppointment(existingAppointment)).rejects.toThrow(
        'Failed to update case appointment ca-1.',
      );
    });
  });
});
