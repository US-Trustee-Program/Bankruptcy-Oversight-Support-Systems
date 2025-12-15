import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { TrusteeAppointmentsUseCase } from './trustee-appointments';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';

describe('TrusteeAppointmentsUseCase tests', () => {
  let context: ApplicationContext;
  let trusteeAppointmentsUseCase: TrusteeAppointmentsUseCase;

  describe('getTrusteeAppointment', () => {
    beforeEach(async () => {
      context = await createMockApplicationContext();
      trusteeAppointmentsUseCase = new TrusteeAppointmentsUseCase(context);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should return a single trustee appointment', async () => {
      const appointmentId = 'appointment-123';
      const mockAppointment = MockData.getTrusteeAppointment({ id: appointmentId });
      jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockAppointment);

      const result = await trusteeAppointmentsUseCase.getTrusteeAppointment(context, appointmentId);

      expect(result).toEqual(mockAppointment);
      expect(MockMongoRepository.prototype.read).toHaveBeenCalledWith(appointmentId);
    });

    test('should handle repository error when appointment not found', async () => {
      const appointmentId = 'non-existent-appointment';
      const repositoryError = new Error('Trustee appointment not found');

      jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.getTrusteeAppointment(context, appointmentId),
      );
      expect(actualError.isCamsError).toBe(true);
    });

    test('should log the retrieval of appointment', async () => {
      const appointmentId = 'appointment-123';
      const mockAppointment = MockData.getTrusteeAppointment({ id: appointmentId });
      const logSpy = jest.spyOn(context.logger, 'info');

      jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockAppointment);

      await trusteeAppointmentsUseCase.getTrusteeAppointment(context, appointmentId);

      expect(logSpy).toHaveBeenCalledWith(
        'TRUSTEE-APPOINTMENTS-USE-CASE',
        `Retrieved trustee appointment ${appointmentId}`,
      );
    });
  });

  describe('getTrusteeAppointments', () => {
    beforeEach(async () => {
      context = await createMockApplicationContext();
      trusteeAppointmentsUseCase = new TrusteeAppointmentsUseCase(context);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should return list of appointments for a trustee', async () => {
      const trusteeId = 'trustee-123';
      const mockAppointments = [
        MockData.getTrusteeAppointment({ trusteeId }),
        MockData.getTrusteeAppointment({ trusteeId }),
      ];
      jest
        .spyOn(MockMongoRepository.prototype, 'getTrusteeAppointments')
        .mockResolvedValue(mockAppointments);

      const result = await trusteeAppointmentsUseCase.getTrusteeAppointments(context, trusteeId);

      expect(result).toEqual(mockAppointments);
      expect(MockMongoRepository.prototype.getTrusteeAppointments).toHaveBeenCalledWith(trusteeId);
    });

    test('should return empty array when trustee has no appointments', async () => {
      const trusteeId = 'trustee-456';
      jest.spyOn(MockMongoRepository.prototype, 'getTrusteeAppointments').mockResolvedValue([]);

      const result = await trusteeAppointmentsUseCase.getTrusteeAppointments(context, trusteeId);

      expect(result).toEqual([]);
    });

    test('should handle repository error during appointments retrieval', async () => {
      const trusteeId = 'trustee-123';
      const repositoryError = new Error('Database error');

      jest
        .spyOn(MockMongoRepository.prototype, 'getTrusteeAppointments')
        .mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteeAppointmentsUseCase.getTrusteeAppointments(context, trusteeId),
      );
      expect(actualError.isCamsError).toBe(true);
    });

    test('should log the retrieval of appointments', async () => {
      const trusteeId = 'trustee-123';
      const mockAppointments = [
        MockData.getTrusteeAppointment({ trusteeId }),
        MockData.getTrusteeAppointment({ trusteeId }),
      ];
      const logSpy = jest.spyOn(context.logger, 'info');

      jest
        .spyOn(MockMongoRepository.prototype, 'getTrusteeAppointments')
        .mockResolvedValue(mockAppointments);

      await trusteeAppointmentsUseCase.getTrusteeAppointments(context, trusteeId);

      expect(logSpy).toHaveBeenCalledWith(
        'TRUSTEE-APPOINTMENTS-USE-CASE',
        `Retrieved ${mockAppointments.length} appointments for trustee ${trusteeId}`,
      );
    });
  });
});
