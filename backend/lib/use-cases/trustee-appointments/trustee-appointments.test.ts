import { vi, Mock } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import MockData from '@common/cams/test-utilities/mock-data';
import { TrusteeAppointmentsUseCase } from './trustee-appointments';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { AppointmentType } from '@common/cams/trustees';
import { CourtsUseCase } from '../courts/courts';
import { CourtDivisionDetails } from '@common/cams/courts';
import factory from '../../factory';
import { TrusteeChangeNotificationEvent } from '@common/cams/dataflow-events';

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

  describe('updateAppointment notification dispatch', () => {
    const trusteeId = 'trustee-notify-apt';
    const appointmentId = 'appointment-notify-1';
    let queueTrusteeChangeNotificationSpy: Mock<
      (event: TrusteeChangeNotificationEvent) => Promise<void>
    >;

    afterEach(() => {
      // See the matching comment in trustees.test.ts: createMockApplicationContext()
      // reassigns process.env wholesale, so vi.stubEnv bookkeeping can't be relied on here.
      delete process.env.CAMS_FRONTEND_URL;
    });

    beforeEach(async () => {
      vi.restoreAllMocks();
      context = await createMockApplicationContext();
      context.featureFlags['trustee-change-notification-enabled'] = true;

      queueTrusteeChangeNotificationSpy = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(factory, 'getApiToDataflowsGateway').mockReturnValue({
        queueTrusteeChangeNotification: queueTrusteeChangeNotificationSpy,
        queueCaseAssignmentEvent: vi.fn(),
        queueTrusteeAppointmentEvent: vi.fn(),
        queueCaseReload: vi.fn(),
        queueTrusteeVerificationRemap: vi.fn(),
      });

      trusteeAppointmentsUseCase = new TrusteeAppointmentsUseCase(context);

      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();
      vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([]);
    });

    test('does not enqueue when feature flag is disabled', async () => {
      context.featureFlags['trustee-change-notification-enabled'] = false;

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
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(
        updatedAppointment,
      );

      await trusteeAppointmentsUseCase.updateAppointment(context, trusteeId, appointmentId, {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCode: '001',
        appointedDate: '2024-01-15',
        status: 'voluntarily-suspended',
        effectiveDate: '2024-01-15',
      });

      expect(queueTrusteeChangeNotificationSpy).not.toHaveBeenCalled();
    });

    test('enqueues one changeSet when appointment status changes', async () => {
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

      await trusteeAppointmentsUseCase.updateAppointment(context, trusteeId, appointmentId, {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCode: '001',
        appointedDate: '2024-01-15',
        status: 'voluntarily-suspended',
        effectiveDate: '2024-01-15',
      });

      expect(queueTrusteeChangeNotificationSpy).toHaveBeenCalledTimes(1);
      const { changeSet } = queueTrusteeChangeNotificationSpy.mock.calls[0][0];
      expect(changeSet.trusteeId).toBe(trusteeId);
      expect(changeSet.trusteeName).toBe('Henry Green');
      expect(changeSet.subjectOverride).toBe('Trustee Appointment Changed: Henry Green');
      expect(changeSet.fields).toEqual([expect.objectContaining({ label: 'Status' })]);
    });

    test('returns the updated appointment successfully when the enqueue call rejects', async () => {
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
      queueTrusteeChangeNotificationSpy.mockRejectedValue(new Error('queue unavailable'));
      const errorSpy = vi.spyOn(context.logger, 'error');

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
      expect(errorSpy).toHaveBeenCalledWith(
        'TRUSTEE-APPOINTMENTS-USE-CASE',
        '[notification-send-failure] Failed to prepare or enqueue appointment change notification.',
        expect.any(Error),
      );
    });

    test('does not enqueue when appointment does not change', async () => {
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

      expect(queueTrusteeChangeNotificationSpy).not.toHaveBeenCalled();
    });

    test('enqueued changeSet reflects a chapter change to 11-subchapter-v', async () => {
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

      expect(queueTrusteeChangeNotificationSpy).toHaveBeenCalledTimes(1);
      const { changeSet } = queueTrusteeChangeNotificationSpy.mock.calls[0][0];
      // Chapter-based mailbox routing (Sub-V vs. default oversight) now happens downstream in
      // TrusteeChangeNotificationUseCase.notify(), which is exercised directly in
      // trustee-change-notification.test.ts. This only confirms the routing input is threaded
      // through correctly.
      expect(changeSet.chapters).toEqual(['11-subchapter-v']);
    });

    test('enqueued changeSet includes author info and profileLink', async () => {
      process.env.CAMS_FRONTEND_URL = 'https://cams.ustp.gov';
      context.session.user = {
        ...context.session.user,
        name: 'Alex Rivera',
        email: 'alex@ustp.test',
      };

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

      await trusteeAppointmentsUseCase.updateAppointment(context, trusteeId, appointmentId, {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        divisionCode: '001',
        appointedDate: '2024-01-15',
        status: 'voluntarily-suspended',
        effectiveDate: '2024-01-15',
      });

      expect(queueTrusteeChangeNotificationSpy).toHaveBeenCalledWith({
        changeSet: expect.objectContaining({
          author: { name: 'Alex Rivera', email: 'alex@ustp.test' },
          profileLink: `https://cams.ustp.gov/trustees/${trusteeId}`,
        }),
      });
    });

    test('enqueued changeSet threads live courts data into the District (Division) field', async () => {
      // Full district/division formatting rules (all-divisions collapsing, per-division listing,
      // etc.) are exhaustively covered in build-appointment-change-set.test.ts. This only confirms
      // CourtsUseCase.getCourts() results are actually wired into the resolvers passed to
      // buildAppointmentChangeSet.
      const courts: CourtDivisionDetails[] = [
        {
          officeName: 'Manhattan',
          officeCode: '081',
          courtId: '0208',
          courtName: 'Southern District of New York',
          courtDivisionCode: '081',
          courtDivisionName: 'Manhattan',
          groupDesignator: 'NY',
          regionId: '02',
          regionName: 'NEW YORK',
        },
        {
          officeName: 'Brooklyn',
          officeCode: '071',
          courtId: '0208',
          courtName: 'Southern District of New York',
          courtDivisionCode: '071',
          courtDivisionName: 'Brooklyn',
          groupDesignator: 'NY',
          regionId: '02',
          regionName: 'NEW YORK',
        },
      ];
      vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue(courts);

      const mockTrustee = MockData.getTrustee({ trusteeId, name: 'Henry Green' });
      const existingAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        trusteeId,
        chapter: '7',
        appointmentType: 'panel',
        courtId: '0208',
        divisionCodes: ['081'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });
      const updatedAppointment = {
        ...existingAppointment,
        divisionCode: '071',
        divisionCodes: ['071'],
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValueOnce(existingAppointment);
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValueOnce(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(
        updatedAppointment,
      );

      await trusteeAppointmentsUseCase.updateAppointment(context, trusteeId, appointmentId, {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '0208',
        divisionCodes: ['071'],
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-15',
      });

      const { changeSet } = queueTrusteeChangeNotificationSpy.mock.calls[0][0];
      const districtField = changeSet.fields.find(
        (field: { label: string }) => field.label === 'District (Division)',
      );
      expect(districtField.comparisons[0].before).toBe('Southern District of New York (Manhattan)');
      expect(districtField.comparisons[0].after).toBe('Southern District of New York (Brooklyn)');
    });
  });

  describe('createAppointment notification dispatch', () => {
    const trusteeId = 'trustee-notify-create';
    let queueTrusteeChangeNotificationSpy: Mock<
      (event: TrusteeChangeNotificationEvent) => Promise<void>
    >;

    beforeEach(async () => {
      vi.restoreAllMocks();
      context = await createMockApplicationContext();
      context.featureFlags['trustee-change-notification-enabled'] = true;

      queueTrusteeChangeNotificationSpy = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(factory, 'getApiToDataflowsGateway').mockReturnValue({
        queueTrusteeChangeNotification: queueTrusteeChangeNotificationSpy,
        queueCaseAssignmentEvent: vi.fn(),
        queueTrusteeAppointmentEvent: vi.fn(),
        queueCaseReload: vi.fn(),
        queueTrusteeVerificationRemap: vi.fn(),
      });

      trusteeAppointmentsUseCase = new TrusteeAppointmentsUseCase(context);

      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();
      vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([]);
    });

    test('does not enqueue when feature flag is disabled', async () => {
      context.featureFlags['trustee-change-notification-enabled'] = false;

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

      expect(queueTrusteeChangeNotificationSpy).not.toHaveBeenCalled();
    });

    test('enqueues a changeSet when a new appointment is created', async () => {
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

      expect(queueTrusteeChangeNotificationSpy).toHaveBeenCalledTimes(1);
      const { changeSet } = queueTrusteeChangeNotificationSpy.mock.calls[0][0];
      expect(changeSet.trusteeId).toBe(trusteeId);
      expect(changeSet.subjectOverride).toBe('New Trustee Appointment: Henry Green');
      expect(changeSet.chapters).toEqual(['7']);
    });

    test('returns the created appointment successfully when the enqueue call rejects', async () => {
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
      queueTrusteeChangeNotificationSpy.mockRejectedValue(new Error('queue unavailable'));
      const errorSpy = vi.spyOn(context.logger, 'error');

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
      expect(errorSpy).toHaveBeenCalledWith(
        'TRUSTEE-APPOINTMENTS-USE-CASE',
        '[notification-send-failure] Failed to prepare or enqueue appointment change notification.',
        expect.any(Error),
      );
    });

    test('enqueued changeSet reflects the created appointment chapter', async () => {
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

      const { changeSet } = queueTrusteeChangeNotificationSpy.mock.calls[0][0];
      expect(changeSet.chapters).toEqual(['13']);
    });
  });
});
