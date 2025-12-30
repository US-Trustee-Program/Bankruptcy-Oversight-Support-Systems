import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { TrusteeAppointmentsUseCase } from './trustee-appointments';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeAppointmentInput } from '../../../../common/src/cams/trustee-appointments';

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

      expect(result).toEqual(mockAppointments);
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
      chapter: '7-panel',
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

      const result = await trusteeAppointmentsUseCase.createAppointment(
        context,
        trusteeId,
        appointmentInput,
      );

      expect(result).toEqual(mockCreatedAppointment);
      expect(MockMongoRepository.prototype.read).toHaveBeenCalledWith(trusteeId);
      expect(MockMongoRepository.prototype.createAppointment).toHaveBeenCalledWith(
        trusteeId,
        appointmentInput,
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

      await trusteeAppointmentsUseCase.createAppointment(context, trusteeId, appointmentInput);

      expect(logSpy).toHaveBeenCalledWith(
        'TRUSTEE-APPOINTMENTS-USE-CASE',
        `Created appointment ${mockCreatedAppointment.id} for trustee ${trusteeId}`,
      );
    });
  });

  describe('updateAppointment', () => {
    const trusteeId = 'trustee-123';
    const appointmentId = 'appointment-123';
    const appointmentUpdate: TrusteeAppointmentInput = {
      chapter: '11',
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
      const mockUpdatedAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        ...appointmentUpdate,
      });

      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(
        mockUpdatedAppointment,
      );

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
        appointmentUpdate,
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
      const mockUpdatedAppointment = MockData.getTrusteeAppointment({
        id: appointmentId,
        ...appointmentUpdate,
      });
      const logSpy = vi.spyOn(context.logger, 'info');

      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockResolvedValue(
        mockUpdatedAppointment,
      );

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
  });
});
