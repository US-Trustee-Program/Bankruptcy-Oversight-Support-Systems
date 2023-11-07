import { CamsError } from '../../common-errors/cams-error';
import { ApplicationContext } from '../types/basic';

export default class log {
  public static sanitize(input: string): string {
    return input.replace(/[\r\n]+/g, ' ').trim();
  }

  private static logMessage(
    applicationContext: ApplicationContext,
    logType: string,
    moduleName: string,
    message: string,
    data?: unknown,
  ) {
    const logString = `[${logType.toUpperCase()}] [${moduleName}] ${message} ${
      undefined != data ? JSON.stringify(data) : ''
    }`;
    if (
      Object.prototype.hasOwnProperty.call(applicationContext, 'log') &&
      typeof applicationContext.log === 'function'
    ) {
      applicationContext.log(log.sanitize(logString.trim()));
    } else {
      throw new Error('Context does not contain a log function');
    }
  }

  public static info(
    applicationContext: ApplicationContext,
    moduleName: string,
    message: string,
    data?: unknown,
  ) {
    log.logMessage(applicationContext, 'info', moduleName, message, data);
  }

  public static warn(
    applicationContext: ApplicationContext,
    moduleName: string,
    message: string,
    data?: unknown,
  ) {
    log.logMessage(applicationContext, 'warn', moduleName, message, data);
  }

  public static error(
    applicationContext: ApplicationContext,
    moduleName: string,
    message: string,
    data?: unknown,
  ) {
    log.logMessage(applicationContext, 'error', moduleName, message, data);
  }

  public static debug(
    applicationContext: ApplicationContext,
    moduleName: string,
    message: string,
    data?: unknown,
  ) {
    log.logMessage(applicationContext, 'debug', moduleName, message, data);
  }

  public static camsError(applicationContext: ApplicationContext, camsError: CamsError) {
    log.logMessage(applicationContext, 'error', camsError.module, camsError.message, camsError);
  }
}
