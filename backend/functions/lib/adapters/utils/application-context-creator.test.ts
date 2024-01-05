import { CamsError } from '../../common-errors/cams-error';
import { LoggerImpl } from './application-context-creator';

const log = jest.spyOn(console, 'log').mockImplementation(() => {});

const MODULE_NAME = 'APPLICATION-CONTEXT-CREATOR-TEST';

describe('Application Context Creator tests', () => {
  let logger;

  beforeEach(() => {
    logger = new LoggerImpl();
  });

  test('Should properly log message when calling info without data defined', () => {
    const msg = 'info test';
    logger.info(MODULE_NAME, msg);
    expect(log).toHaveBeenCalledWith(`[INFO] [APPLICATION-CONTEXT-CREATOR-TEST] ${msg}`);
  });

  test('Should properly log message when calling info with data defined', () => {
    const msg = 'info test';
    logger.info(MODULE_NAME, msg, { testMessage: msg });
    expect(log).toHaveBeenCalledWith(
      `[INFO] [APPLICATION-CONTEXT-CREATOR-TEST] ${msg} {"testMessage":"${msg}"}`,
    );
  });

  test('Should properly log message when calling warn', () => {
    const msg = 'warning test';
    logger.warn(MODULE_NAME, msg, { testMessage: msg });
    expect(log).toHaveBeenCalledWith(
      `[WARN] [APPLICATION-CONTEXT-CREATOR-TEST] ${msg} {"testMessage":"${msg}"}`,
    );
  });

  test('Should properly log message when calling error', () => {
    const msg = 'error test';
    logger.error(MODULE_NAME, msg, { testMessage: msg });
    expect(log).toHaveBeenCalledWith(
      `[ERROR] [APPLICATION-CONTEXT-CREATOR-TEST] ${msg} {"testMessage":"${msg}"}`,
    );
  });

  test('Should properly log message when calling debug', () => {
    const msg = 'debug test';
    logger.debug(MODULE_NAME, msg, { testMessage: msg });
    expect(log).toHaveBeenCalledWith(
      `[DEBUG] [APPLICATION-CONTEXT-CREATOR-TEST] ${msg} {"testMessage":"${msg}"}`,
    );
  });

  test('Should properly log message when calling camsError', () => {
    const error = new CamsError(MODULE_NAME);
    logger.camsError(error);
    expect(log).toHaveBeenCalledWith(
      `[ERROR] [APPLICATION-CONTEXT-CREATOR-TEST] Unknown CAMS Error {"message":"Unknown CAMS Error","status":500,"module":"APPLICATION-CONTEXT-CREATOR-TEST"}`,
    );
  });
});
