import { LoggerImpl } from '../lib/adapters/services/logger.service';
import { CamsError } from '../lib/common-errors/cams-error';
import { timerTrigger, weeklyTrigger } from './office-staff-sync.function';
import { Timer } from '@azure/functions';
import { createMockAzureFunctionContext } from '../azure/testing-helpers';
import { OfficesController } from '../lib/controllers/offices/offices.controller';

describe('Office Staff Sync Function tests', () => {
  const context = createMockAzureFunctionContext();
  const timer: Timer = {
    isPastDue: false,
    schedule: {
      adjustForDST: false,
    },
    scheduleStatus: {
      last: '',
      next: '',
      lastUpdated: '',
    },
  };

  test('Should call offices controller method handleTimer from timerTrigger function with weekly = false', async () => {
    const handleTimer = jest
      .spyOn(OfficesController.prototype, 'handleTimer')
      .mockImplementation(() => Promise.resolve());
    await timerTrigger(timer, context);
    expect(handleTimer).toHaveBeenCalledWith(expect.anything());
  });

  test('Should call offices controller method handleTimer from weeklyTrigger function with weekly = true', async () => {
    const handleTimer = jest
      .spyOn(OfficesController.prototype, 'handleTimer')
      .mockImplementation(() => Promise.resolve());
    await weeklyTrigger(timer, context);
    expect(handleTimer).toHaveBeenCalledWith(expect.anything(), true);
  });

  test('Should log a camsError if handleTimer throws a CamsError', async () => {
    const handleTimer = jest
      .spyOn(OfficesController.prototype, 'handleTimer')
      .mockRejectedValue(new CamsError('TEST_MODULE', { message: 'error' }));
    const camsError = jest.spyOn(LoggerImpl.prototype, 'camsError').mockImplementation(() => {});
    await timerTrigger(timer, context);
    expect(handleTimer).toHaveBeenCalled();
    expect(camsError).toHaveBeenCalled();
  });
});
