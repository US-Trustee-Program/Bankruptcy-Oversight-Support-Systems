import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import MockData from '@common/cams/test-utilities/mock-data';
import { TrusteeAppointmentsUseCase } from './trustee-appointments';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { AppointmentType } from '@common/cams/trustees';
import { MockNotificationGateway } from '../../adapters/gateways/notifications/mock-notification.gateway';

describe('TrusteeAppointmentsUseCase tests', () => {
  let context: ApplicationContext;
  let trusteeAppointmentsUseCase: TrusteeAppointmentsUseCase;

  describe('getTrusteeAppointments', () => {
    beforeEach(async () => {
      context = await createMockApplicationContext();
      trusteeAppointmentsUseCase = new TrusteeAppointmentsUseCase(context);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should return list of appointments for a trustee', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const mockAppointments = [
        MockData.getTrusteeAppointment({ trusteeId }),
        MockData.getTrusteeAppointment({ trusteeId }),
      ];

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeAppointments').mockResolvedValue(
        mockAppointments,
      );

      const result = await trusteeAppointmentsUseCase.getTrusteeAppointments(context, trusteeId);

      // Expect enriched appointments with courtName but courtDivisionName set to undefined
      const expectedEnrichedAppointments = mockAppointments.map((apt) => ({
        ...apt,
        courtDivisionName: undefined, // Division names are not used per product requirements
      }));

      expect(result).toEqual(expectedEnrichedAppointments);
      expect(MockMongoRepository.prototype.read).toHaveBeenCalledWith(trusteeId);
      expect(MockMongoRepository.prototype.getTrusteeAppointments).toHaveBeenCalledWith(trusteeId);
    });

    test('should return empty array when trustee has no appointments', async () => {
      const trusteeId = 'trustee-456';
      const mockTrustee = MockData.getTrustee({ trusteeId });

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeAppointments').mockResolvedValue([]);

      const result = await trusteeAppointmentsUseCase.getTrusteeAppointments(context, trusteeId);

      expect(result).toEqual([]);
      expect(MockMongoRepository.prototype.read).toHaveBeenCalledWith(trusteeId);
    });

    test('should throw NotFoundError when trustee does not exist', async () => {
      const trusteeId = 'non-existent-trustee';
      const repositoryError = new Error('Trustee not found');

      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.getTrusteeAppointments(context, trusteeId),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain('Trustee with ID non-existent-trustee not found.');
    });

    test('should handle repository error during appointments retrieval', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const repositoryError = new Error('Database error');

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeAppointments').mockRejectedValue(
        repositoryError,
      );

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.getTrusteeAppointments(context, trusteeId),
      );
      expect(actualError.isCamsError).toBe(true);
    });
  });

  describe('createAppointment', () => {
    const appointmentInput: TrusteeAppointmentInput = {
      chapter: '7',
      appointmentType: 'panel',
      courtId: '081',
      divisionCode: '1',
      appointedDate: '2024-01-15',
      status: 'active',
      effectiveDate: '2024-01-15T00:00:00.000Z',
    };

    beforeEach(async () => {
      context = await createMockApplicationContext();
      trusteeAppointmentsUseCase = new TrusteeAppointmentsUseCase(context);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should create a new appointment for a trustee', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const mockCreatedAppointment = MockData.getTrusteeAppointment({
        trusteeId,
        ...appointmentInput,
      });

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createAppointment').mockResolvedValue(
        mockCreatedAppointment,
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue([]);

      const result = await trusteeAppointmentsUseCase.createAppointment(
        context,
        trusteeId,
        appointmentInput,
      );

      expect(result).toEqual(mockCreatedAppointment);
      expect(MockMongoRepository.prototype.read).toHaveBeenCalledWith(trusteeId);
      expect(MockMongoRepository.prototype.createAppointment).toHaveBeenCalledWith(
        trusteeId,
        expect.objectContaining({
          ...appointmentInput,
          divisionCodes: ['1'], // Normalized from divisionCode
        }),
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
        }),
      );
    });

    test('should throw NotFoundError when trustee does not exist', async () => {
      const trusteeId = 'non-existent-trustee';
      const repositoryError = new Error('Trustee not found');

      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.createAppointment(context, trusteeId, appointmentInput),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain(`Trustee with ID ${trusteeId} not found.`);
    });

    test('should handle repository error during appointment creation', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const repositoryError = new Error('Database error');

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createAppointment').mockRejectedValue(
        repositoryError,
      );

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.createAppointment(context, trusteeId, appointmentInput),
      );

      expect(actualError.isCamsError).toBe(true);
    });

    test('should log the creation of appointment', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const mockCreatedAppointment = MockData.getTrusteeAppointment({
        trusteeId,
        ...appointmentInput,
      });
      const logSpy = vi.spyOn(context.logger, 'info');

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createAppointment').mockResolvedValue(
        mockCreatedAppointment,
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue([]);

      await trusteeAppointmentsUseCase.createAppointment(context, trusteeId, appointmentInput);

      expect(logSpy).toHaveBeenCalledWith(
        'TRUSTEE-APPOINTMENTS-USE-CASE',
        `Created appointment ${mockCreatedAppointment.id} for trustee ${trusteeId}`,
      );
    });

    test('should throw error when appointmentType is invalid for chapter', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const invalidAppointmentInput: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'standing' as unknown as AppointmentType,
        courtId: '081',
        divisionCode: '1',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.createAppointment(context, trusteeId, invalidAppointmentInput),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain(
        'Appointment type "standing" is not valid for chapter 7',
      );
    });

    test('should throw error when status is invalid for chapter and appointmentType', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const invalidAppointmentInput: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCode: '1',
        appointedDate: '2024-01-15',
        status: 'deceased',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.createAppointment(context, trusteeId, invalidAppointmentInput),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain(
        'Status "deceased" is not valid for chapter 7 with appointment type "panel"',
      );
    });

    test('should throw error when appointmentType is pool for Chapter 7', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const invalidAppointmentInput: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'pool' as unknown as AppointmentType,
        courtId: '081',
        divisionCode: '1',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.createAppointment(context, trusteeId, invalidAppointmentInput),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain('Appointment type "pool" is not valid for chapter 7');
    });

    test('should throw error when status is active for Chapter 7 off-panel', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const invalidAppointmentInput: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'off-panel',
        courtId: '081',
        divisionCode: '1',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.createAppointment(context, trusteeId, invalidAppointmentInput),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain(
        'Status "active" is not valid for chapter 7 with appointment type "off-panel"',
      );
    });
  });

  describe('updateAppointment', () => {
    const trusteeId = 'trustee-123';
    const appointmentId = 'appointment-123';
    const appointmentUpdate: TrusteeAppointmentInput = {
      chapter: '11',
      appointmentType: 'case-by-case',
      courtId: '081',
      divisionCode: '2',
      appointedDate: '2024-02-01',
      status: 'inactive',
      effectiveDate: '2024-02-15T00:00:00.000Z',
    };

    beforeEach(async () => {
      context = await createMockApplicationContext();
      trusteeAppointmentsUseCase = new TrusteeAppointmentsUseCase(context);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should update an appointment successfully', async () => {
      const mockExistingAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
      });
      const mockUpdatedAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        ...appointmentUpdate,
      });

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockExistingAppointment);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(
        mockUpdatedAppointment,
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue([]);

      const result = await trusteeAppointmentsUseCase.updateAppointment(
        context,
        trusteeId,
        appointmentId,
        appointmentUpdate,
      );

      expect(result).toEqual(mockUpdatedAppointment);
      expect(MockMongoRepository.prototype.updateAppointment).toHaveBeenCalledWith(
        trusteeId,
        appointmentId,
        expect.objectContaining({
          ...appointmentUpdate,
          divisionCodes: ['2'], // Normalized from divisionCode
        }),
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
        }),
      );
    });

    test('should throw error when appointment does not exist', async () => {
      const repositoryError = new Error('Trustee appointment not found');

      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockRejectedValue(
        repositoryError,
      );

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.updateAppointment(
          context,
          trusteeId,
          appointmentId,
          appointmentUpdate,
        ),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.camsStack).toEqual([
        expect.objectContaining({
          message: `Failed to update appointment ${appointmentId}.`,
          module: 'TRUSTEE-APPOINTMENTS-USE-CASE',
        }),
      ]);
    });

    test('should handle repository error during update', async () => {
      const repositoryError = new Error('Database error');

      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockRejectedValue(
        repositoryError,
      );

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.updateAppointment(
          context,
          trusteeId,
          appointmentId,
          appointmentUpdate,
        ),
      );

      expect(actualError.isCamsError).toBe(true);
    });

    test('should log the update of appointment', async () => {
      const mockExistingAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
      });
      const mockUpdatedAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        ...appointmentUpdate,
      });
      const logSpy = vi.spyOn(context.logger, 'info');

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockExistingAppointment);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(
        mockUpdatedAppointment,
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue([]);

      await trusteeAppointmentsUseCase.updateAppointment(
        context,
        trusteeId,
        appointmentId,
        appointmentUpdate,
      );

      expect(logSpy).toHaveBeenCalledWith(
        'TRUSTEE-APPOINTMENTS-USE-CASE',
        `Updated appointment ${appointmentId}`,
      );
    });

    test('should create audit history when appointment changes', async () => {
      const mockExistingAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        courtId: '081',
        chapter: '7',
        appointmentType: 'panel',
        divisionCode: 'MAB',
      });
      const mockUpdatedAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        ...appointmentUpdate,
      });
      const mockCourts = [
        {
          courtId: '081',
          courtDivisionCode: 'MAB',
          courtName: 'Test Court',
          courtDivisionName: 'Boston',
          officeName: 'Test Office',
          officeCode: 'MA',
          groupDesignator: 'MA',
          regionId: '02',
          regionName: 'Boston',
        },
        {
          courtId: '081',
          courtDivisionCode: 'MAW',
          courtName: 'Test Court',
          courtDivisionName: 'Worcester',
          officeName: 'Test Office',
          officeCode: 'MA',
          groupDesignator: 'MA',
          regionId: '02',
          regionName: 'Boston',
        },
        {
          courtId: '081',
          courtDivisionCode: '2',
          courtName: 'Test Court',
          courtDivisionName: 'Worcester',
          officeName: 'Test Office',
          officeCode: 'MA',
          groupDesignator: 'MA',
          regionId: '02',
          regionName: 'Boston',
        },
      ];

      const historyUpdateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockExistingAppointment);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(
        mockUpdatedAppointment,
      );
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue(
        mockCourts,
      );

      await trusteeAppointmentsUseCase.updateAppointment(
        context,
        trusteeId,
        appointmentId,
        appointmentUpdate,
      );

      expect(historyUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_APPOINTMENT',
          trusteeId,
          appointmentId,
          before: expect.objectContaining({
            chapter: '7',
            appointmentType: 'panel',
            divisionCode: 'MAB',
            courtName: 'Test Court',
            courtDivisionName: undefined, // Division names are not used per product requirements
          }),
          after: expect.objectContaining({
            chapter: '11',
            divisionCode: '2',
            courtName: 'Test Court',
            courtDivisionName: undefined, // Division names are not used per product requirements
          }),
        }),
      );
    });

    test('should not create audit history when appointment does not change', async () => {
      const unchangedAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        ...appointmentUpdate,
      });

      const historyUpdateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(unchangedAppointment);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(
        unchangedAppointment,
      );
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue([]);

      await trusteeAppointmentsUseCase.updateAppointment(
        context,
        trusteeId,
        appointmentId,
        appointmentUpdate,
      );

      expect(historyUpdateSpy).not.toHaveBeenCalled();
    });

    test('should throw error when appointmentType is invalid for chapter', async () => {
      const invalidAppointmentUpdate: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'standing' as unknown as AppointmentType,
        courtId: '081',
        divisionCode: '1',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      };

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.updateAppointment(
          context,
          trusteeId,
          appointmentId,
          invalidAppointmentUpdate,
        ),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain(
        'Appointment type "standing" is not valid for chapter 7',
      );
    });

    test('should throw error when status is invalid for chapter and appointmentType', async () => {
      const invalidAppointmentUpdate: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCode: '1',
        appointedDate: '2024-01-15',
        status: 'deceased',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      };

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.updateAppointment(
          context,
          trusteeId,
          appointmentId,
          invalidAppointmentUpdate,
        ),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain(
        'Status "deceased" is not valid for chapter 7 with appointment type "panel"',
      );
    });

    test('should throw error when updating to pool appointmentType for Chapter 7', async () => {
      const invalidAppointmentUpdate: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'pool' as unknown as AppointmentType,
        courtId: '081',
        divisionCode: '1',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      };

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.updateAppointment(
          context,
          trusteeId,
          appointmentId,
          invalidAppointmentUpdate,
        ),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain('Appointment type "pool" is not valid for chapter 7');
    });

    test('should throw error when updating status to deceased for Chapter 11 Subchapter V pool', async () => {
      const invalidAppointmentUpdate: TrusteeAppointmentInput = {
        chapter: '11-subchapter-v',
        appointmentType: 'pool',
        courtId: '081',
        divisionCode: '1',
        appointedDate: '2024-01-15',
        status: 'deceased',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      };

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.updateAppointment(
          context,
          trusteeId,
          appointmentId,
          invalidAppointmentUpdate,
        ),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain(
        'Status "deceased" is not valid for chapter 11-subchapter-v with appointment type "pool"',
      );
    });
  });

  describe('updateAppointment notification dispatch (CAMS-768 Slice 2)', () => {
    const trusteeId = 'trustee-notify-apt';
    const appointmentId = 'appointment-notify-1';

    beforeEach(async () => {
      vi.restoreAllMocks();
      context = await createMockApplicationContext();
      trusteeAppointmentsUseCase = new TrusteeAppointmentsUseCase(context);
      MockNotificationGateway.getInstance().clear();

      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue([]);

      vi.spyOn(MockMongoRepository.prototype, 'findRecipientByKey').mockImplementation(
        async (key: string) => {
          if (key === 'chapter:11-subchapter-v') {
            return {
              key: 'chapter:11-subchapter-v',
              recipientAddress: 'subv@example.test',
              displayName: 'Sub-V Oversight',
            };
          }
          if (key === 'chapter:7') {
            return {
              key: 'chapter:7',
              recipientAddress: 'ch7-oversight@example.test',
              displayName: 'CH7 Oversight',
            };
          }
          return null;
        },
      );
      vi.spyOn(MockMongoRepository.prototype, 'getDefaultRecipient').mockResolvedValue({
        key: 'default',
        recipientAddress: 'default-oversight@example.test',
        displayName: 'Default Oversight',
      });
    });

    afterEach(() => {
      MockNotificationGateway.getInstance().clear();
    });

    test('dispatches one notification when appointment chapter changes', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId, name: 'Henry Green' });
      const existingAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCodes: ['001'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });
      const updatedAppointment = {
        ...existingAppointment,
        chapter: '11-subchapter-v' as const,
        appointmentType: 'pool' as const,
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValueOnce(existingAppointment);
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValueOnce(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(
        updatedAppointment,
      );

      await trusteeAppointmentsUseCase.updateAppointment(context, trusteeId, appointmentId, {
        chapter: '11-subchapter-v',
        appointmentType: 'pool',
        courtId: '081',
        divisionCode: '001',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });

      const recorded = MockNotificationGateway.getInstance().getRecorded();
      expect(recorded).toHaveLength(1);
      expect(recorded[0].subject).toContain('Trustee Appointment Changed');
      expect(recorded[0].html).toContain('Chapter');
    });

    test('notification failure does not fail the appointment save', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId, name: 'Henry Green' });
      const existingAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCodes: ['001'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });
      const updatedAppointment = {
        ...existingAppointment,
        status: 'voluntarily-suspended' as const,
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValueOnce(existingAppointment);
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValueOnce(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(
        updatedAppointment,
      );
      vi.spyOn(MockNotificationGateway.prototype, 'send').mockRejectedValue(
        new Error('Simulated provider failure'),
      );

      const result = await trusteeAppointmentsUseCase.updateAppointment(
        context,
        trusteeId,
        appointmentId,
        {
          chapter: '7',
          appointmentType: 'panel',
          courtId: '081',
          divisionCode: '001',
          appointedDate: '2024-01-15',
          status: 'voluntarily-suspended',
          effectiveDate: '2024-01-15',
        },
      );

      expect(result).toEqual(updatedAppointment);
    });

    test('no notification when appointment does not change', async () => {
      const existingAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCodes: ['001'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingAppointment);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(
        existingAppointment,
      );

      await trusteeAppointmentsUseCase.updateAppointment(context, trusteeId, appointmentId, {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCode: '001',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });

      expect(MockNotificationGateway.getInstance().getRecorded()).toHaveLength(0);
    });

    test('routes to Sub-V mailbox when chapter changes to 11-subchapter-v', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId, name: 'Henry Green' });
      const existingAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCodes: ['001'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });
      const updatedAppointment = {
        ...existingAppointment,
        chapter: '11-subchapter-v' as const,
        appointmentType: 'pool' as const,
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValueOnce(existingAppointment);
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValueOnce(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(
        updatedAppointment,
      );

      await trusteeAppointmentsUseCase.updateAppointment(context, trusteeId, appointmentId, {
        chapter: '11-subchapter-v',
        appointmentType: 'pool',
        courtId: '081',
        divisionCode: '001',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });

      const recorded = MockNotificationGateway.getInstance().getRecorded();
      expect(recorded).toHaveLength(1);
      expect(recorded[0].to).toBe('subv@example.test');
    });

    test('falls back to default recipient when no chapter-specific routing exists', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId, name: 'Henry Green' });
      const existingAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        chapter: '12',
        appointmentType: 'case-by-case',
        courtId: '081',
        divisionCodes: ['001'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });
      const updatedAppointment = {
        ...existingAppointment,
        status: 'inactive' as const,
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValueOnce(existingAppointment);
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValueOnce(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(
        updatedAppointment,
      );

      await trusteeAppointmentsUseCase.updateAppointment(context, trusteeId, appointmentId, {
        chapter: '12',
        appointmentType: 'case-by-case',
        courtId: '081',
        divisionCode: '001',
        appointedDate: '2024-01-15',
        status: 'inactive',
        effectiveDate: '2024-01-15',
      });

      const recorded = MockNotificationGateway.getInstance().getRecorded();
      expect(recorded).toHaveLength(1);
      expect(recorded[0].to).toBe('default-oversight@example.test');
    });
  });

  describe('createAppointment notification dispatch (CAMS-768 Slice 2)', () => {
    const trusteeId = 'trustee-notify-create';

    beforeEach(async () => {
      vi.restoreAllMocks();
      context = await createMockApplicationContext();
      trusteeAppointmentsUseCase = new TrusteeAppointmentsUseCase(context);
      MockNotificationGateway.getInstance().clear();

      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue([]);

      vi.spyOn(MockMongoRepository.prototype, 'findRecipientByKey').mockImplementation(
        async (key: string) => {
          if (key === 'chapter:7') {
            return {
              key: 'chapter:7',
              recipientAddress: 'ch7-oversight@example.test',
              displayName: 'CH7 Oversight',
            };
          }
          if (key === 'chapter:13') {
            return {
              key: 'chapter:13',
              recipientAddress: 'ch13-oversight@example.test',
              displayName: 'CH13 Oversight',
            };
          }
          return null;
        },
      );
      vi.spyOn(MockMongoRepository.prototype, 'getDefaultRecipient').mockResolvedValue({
        key: 'default',
        recipientAddress: 'default-oversight@example.test',
        displayName: 'Default Oversight',
      });
    });

    afterEach(() => {
      MockNotificationGateway.getInstance().clear();
    });

    test('dispatches a notification when a new appointment is created', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId, name: 'Henry Green' });
      const mockCreatedAppointment = MockData.getTrusteeAppointment({
        trusteeId,
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCodes: ['001'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createAppointment').mockResolvedValue(
        mockCreatedAppointment,
      );

      await trusteeAppointmentsUseCase.createAppointment(context, trusteeId, {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCode: '001',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });

      const recorded = MockNotificationGateway.getInstance().getRecorded();
      expect(recorded).toHaveLength(1);
      expect(recorded[0].subject).toContain('New Trustee Appointment');
      expect(recorded[0].html).toContain('Chapter');
      expect(recorded[0].html).toContain('Status');
    });

    test('notification failure does not fail appointment creation', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId, name: 'Henry Green' });
      const mockCreatedAppointment = MockData.getTrusteeAppointment({
        trusteeId,
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCodes: ['001'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createAppointment').mockResolvedValue(
        mockCreatedAppointment,
      );
      vi.spyOn(MockNotificationGateway.prototype, 'send').mockRejectedValue(
        new Error('Simulated provider failure'),
      );

      const result = await trusteeAppointmentsUseCase.createAppointment(context, trusteeId, {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCode: '001',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });

      expect(result).toEqual(mockCreatedAppointment);
    });

    test('routes to the created appointment chapter mailbox', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId, name: 'Henry Green' });
      const mockCreatedAppointment = MockData.getTrusteeAppointment({
        trusteeId,
        chapter: '13',
        appointmentType: 'standing',
        courtId: '081',
        divisionCodes: ['001'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createAppointment').mockResolvedValue(
        mockCreatedAppointment,
      );

      await trusteeAppointmentsUseCase.createAppointment(context, trusteeId, {
        chapter: '13',
        appointmentType: 'standing',
        courtId: '081',
        divisionCode: '001',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });

      const recorded = MockNotificationGateway.getInstance().getRecorded();
      expect(recorded).toHaveLength(1);
      expect(recorded[0].to).toBe('ch13-oversight@example.test');
    });
  });

  describe('createAppointment audit history', () => {
    const appointmentInput: TrusteeAppointmentInput = {
      chapter: '7',
      appointmentType: 'panel',
      courtId: '081',
      divisionCode: 'MAB',
      appointedDate: '2024-01-15',
      status: 'active',
      effectiveDate: '2024-01-15T00:00:00.000Z',
    };

    beforeEach(async () => {
      context = await createMockApplicationContext();
      trusteeAppointmentsUseCase = new TrusteeAppointmentsUseCase(context);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should create audit history when appointment is created', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const mockCreatedAppointment = MockData.getTrusteeAppointment({
        trusteeId,
        ...appointmentInput,
      });
      const mockCourts = [
        {
          courtId: '081',
          courtDivisionCode: 'MAB',
          courtName: 'Test Court',
          courtDivisionName: 'Boston',
          officeName: 'Test Office',
          officeCode: 'MA',
          groupDesignator: 'MA',
          regionId: '02',
          regionName: 'Boston',
        },
      ];

      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createAppointment').mockResolvedValue(
        mockCreatedAppointment,
      );
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue(
        mockCourts,
      );

      await trusteeAppointmentsUseCase.createAppointment(context, trusteeId, appointmentInput);

      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_APPOINTMENT',
          trusteeId,
          appointmentId: mockCreatedAppointment.id,
          before: undefined,
          after: expect.objectContaining({
            chapter: '7',
            appointmentType: 'panel',
            divisionCode: 'MAB',
            courtName: 'Test Court',
            courtDivisionName: undefined, // Division names are not used per product requirements
            status: 'active',
          }),
        }),
      );
    });
  });

  describe('hasAppointmentChanged with divisionCodes', () => {
    beforeEach(async () => {
      context = await createMockApplicationContext();
      trusteeAppointmentsUseCase = new TrusteeAppointmentsUseCase(context);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should detect division addition as change', async () => {
      const appointmentId = 'appointment-123';
      const trusteeId = 'trustee-123';
      const mockExisting = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        courtId: '097',
        chapter: '7',
        appointmentType: 'panel',
        divisionCode: '710',
        divisionCodes: ['710'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      });
      const mockUpdated = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        courtId: '097',
        chapter: '7',
        appointmentType: 'panel',
        divisionCode: '710',
        divisionCodes: ['710', '711'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      });

      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockExisting);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(mockUpdated);
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue([]);

      await trusteeAppointmentsUseCase.updateAppointment(context, trusteeId, appointmentId, {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '097',
        divisionCode: '710',
        divisionCodes: ['710', '711'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      });

      expect(historyCreateSpy).toHaveBeenCalled();
    });

    test('should detect division removal as change', async () => {
      const appointmentId = 'appointment-123';
      const trusteeId = 'trustee-123';
      const mockExisting = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        courtId: '097',
        chapter: '7',
        appointmentType: 'panel',
        divisionCode: '710',
        divisionCodes: ['710', '711'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      });
      const mockUpdated = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        courtId: '097',
        chapter: '7',
        appointmentType: 'panel',
        divisionCode: '711',
        divisionCodes: ['711'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      });

      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockExisting);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(mockUpdated);
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue([]);

      await trusteeAppointmentsUseCase.updateAppointment(context, trusteeId, appointmentId, {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '097',
        divisionCode: '711',
        divisionCodes: ['711'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      });

      expect(historyCreateSpy).toHaveBeenCalled();
    });

    test('should not detect division reordering as change', async () => {
      const appointmentId = 'appointment-123';
      const trusteeId = 'trustee-123';
      const mockExisting = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        courtId: '097',
        chapter: '7',
        appointmentType: 'panel',
        divisionCode: '710',
        divisionCodes: ['710', '711'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      });
      const mockUpdated = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        courtId: '097',
        chapter: '7',
        appointmentType: 'panel',
        divisionCode: '710',
        divisionCodes: ['711', '710'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      });

      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockExisting);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(mockUpdated);
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue([]);

      await trusteeAppointmentsUseCase.updateAppointment(context, trusteeId, appointmentId, {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '097',
        divisionCode: '710',
        divisionCodes: ['711', '710'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      });

      expect(historyCreateSpy).not.toHaveBeenCalled();
    });

    test('should not detect format-only change (single to array with same value) as change', async () => {
      const appointmentId = 'appointment-123';
      const trusteeId = 'trustee-123';
      // Legacy appointment: has divisionCode but no divisionCodes
      const mockExisting = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        courtId: '097',
        chapter: '7',
        appointmentType: 'panel',
        divisionCode: '710',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      });
      // Clear divisionCodes to simulate legacy record
      delete (mockExisting as Record<string, unknown>).divisionCodes;

      const mockUpdated = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        courtId: '097',
        chapter: '7',
        appointmentType: 'panel',
        divisionCode: '710',
        divisionCodes: ['710'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      });

      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockExisting);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(mockUpdated);
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue([]);

      await trusteeAppointmentsUseCase.updateAppointment(context, trusteeId, appointmentId, {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '097',
        divisionCode: '710',
        divisionCodes: ['710'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      });

      expect(historyCreateSpy).not.toHaveBeenCalled();
    });

    test('should detect combined changes (divisions + status) as change', async () => {
      const appointmentId = 'appointment-123';
      const trusteeId = 'trustee-123';
      const mockExisting = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        courtId: '097',
        chapter: '7',
        appointmentType: 'panel',
        divisionCode: '710',
        divisionCodes: ['710'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15T00:00:00.000Z',
      });
      const mockUpdated = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        courtId: '097',
        chapter: '7',
        appointmentType: 'panel',
        divisionCode: '710',
        divisionCodes: ['710', '711'],
        appointedDate: '2024-01-15',
        status: 'voluntarily-suspended',
        effectiveDate: '2024-02-01T00:00:00.000Z',
      });

      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockExisting);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(mockUpdated);
      vi.spyOn(trusteeAppointmentsUseCase['courtsUseCase'], 'getCourts').mockResolvedValue([]);

      await trusteeAppointmentsUseCase.updateAppointment(context, trusteeId, appointmentId, {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '097',
        divisionCode: '710',
        divisionCodes: ['710', '711'],
        appointedDate: '2024-01-15',
        status: 'voluntarily-suspended',
        effectiveDate: '2024-02-01T00:00:00.000Z',
      });

      expect(historyCreateSpy).toHaveBeenCalled();
    });
  });

  describe('multi-division support', () => {
    beforeEach(async () => {
      context = await createMockApplicationContext();
      trusteeAppointmentsUseCase = new TrusteeAppointmentsUseCase(context);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should accept divisionCodes array and normalize to both formats', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });

      const appointmentInput: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCodes: ['1', '2', '3'], // New format: array
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      };

      const mockCreatedAppointment = MockData.getTrusteeAppointment({
        trusteeId,
        ...appointmentInput,
        divisionCode: '1', // Should be normalized to first element
        divisionCodes: ['1', '2', '3'],
      });

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createAppointment').mockResolvedValue(
        mockCreatedAppointment,
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue(undefined);

      const result = await trusteeAppointmentsUseCase.createAppointment(
        context,
        trusteeId,
        appointmentInput,
      );

      expect(result).toEqual(mockCreatedAppointment);
      expect(MockMongoRepository.prototype.createAppointment).toHaveBeenCalledWith(
        trusteeId,
        expect.objectContaining({
          divisionCode: '1', // Normalized to first element
          divisionCodes: ['1', '2', '3'], // Array preserved
        }),
        expect.any(Object),
      );
    });

    test('should convert single divisionCode to divisionCodes array for backward compatibility', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });

      const appointmentInput: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCode: '5', // Old format: single string
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      };

      const mockCreatedAppointment = MockData.getTrusteeAppointment({
        trusteeId,
        ...appointmentInput,
        divisionCode: '5',
        divisionCodes: ['5'], // Should be normalized to array
      });

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createAppointment').mockResolvedValue(
        mockCreatedAppointment,
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue(undefined);

      const result = await trusteeAppointmentsUseCase.createAppointment(
        context,
        trusteeId,
        appointmentInput,
      );

      expect(result).toEqual(mockCreatedAppointment);
      expect(MockMongoRepository.prototype.createAppointment).toHaveBeenCalledWith(
        trusteeId,
        expect.objectContaining({
          divisionCode: '5', // Original preserved
          divisionCodes: ['5'], // Normalized to array
        }),
        expect.any(Object),
      );
    });

    test('should reject appointment with no divisions specified', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });

      const appointmentInput: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        // No divisionCode or divisionCodes specified
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.createAppointment(context, trusteeId, appointmentInput),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain('At least one division must be specified');
    });

    test('should reject appointment with only empty strings in divisionCodes', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });

      const appointmentInput: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCodes: ['', ' '],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.createAppointment(context, trusteeId, appointmentInput),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain('At least one division must be specified');
    });
  });
});
