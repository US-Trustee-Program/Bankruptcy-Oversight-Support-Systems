import { CamsError } from '../../common-errors/cams-error';
import { ApplicationContext } from '../types/basic';

export default class log {
  public static sanitize(input: string): string {
    return input.replace(/[\r\n]+/g, ' ').trim();
  }

  private static logMessage(
    context: ApplicationContext,
    logType: string,
    moduleName: string,
    message: string,
    data?: unknown,
  ) {
    const logString = `[${logType.toUpperCase()}] [${moduleName}] ${message} ${
      undefined != data ? JSON.stringify(data) : ''
    }`;
    if (Object.prototype.hasOwnProperty.call(context, 'log') && typeof context.log === 'function') {
      context.log(log.sanitize(logString.trim()));
    } else {
      throw new Error('Context does not contain a log function');
    }
  }

  public static info(
    context: ApplicationContext,
    moduleName: string,
    message: string,
    data?: unknown,
  ) {
    log.logMessage(context, 'info', moduleName, message, data);
  }

  public static warn(
    context: ApplicationContext,
    moduleName: string,
    message: string,
    data?: unknown,
  ) {
    log.logMessage(context, 'warn', moduleName, message, data);
  }

  public static error(
    context: ApplicationContext,
    moduleName: string,
    message: string,
    data?: unknown,
  ) {
    log.logMessage(context, 'error', moduleName, message, data);
  }

  public static debug(
    context: ApplicationContext,
    moduleName: string,
    message: string,
    data?: unknown,
  ) {
    log.logMessage(context, 'debug', moduleName, message, data);
  }

  public static camsError(context: ApplicationContext, camsError: CamsError) {
    log.logMessage(context, 'error', camsError.module, camsError.message, camsError);
  }
}
