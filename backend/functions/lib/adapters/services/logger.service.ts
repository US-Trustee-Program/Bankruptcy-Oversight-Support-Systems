import { ApplicationContext } from '../types/basic';

export default class log {
  public static sanitize(input: string): string {
    return input.replace(/[\r\n]+/g, ' ').trim();
  }

  private static logMessage(
    context: ApplicationContext,
    logType: string,
    namespace: string,
    message: string,
    data?: unknown,
  ) {
    const logString = `[${logType.toUpperCase()}] [${namespace}] ${message} ${
      undefined != data ? JSON.stringify(data) : ''
    }`;
    if (Object.prototype.hasOwnProperty.call(context, 'log') && typeof context.log === 'function') {
      context.log(log.sanitize(logString.trim()));
    } else {
      console.log('error is to be thrown');
      console.log(Object.prototype.hasOwnProperty.call(context, 'log'));
      console.log(typeof context.log);
      throw new Error('Context does not contain a log function');
    }
  }

  public static info(
    context: ApplicationContext,
    namespace: string,
    message: string,
    data?: unknown,
  ) {
    log.logMessage(context, 'info', namespace, message, data);
  }

  public static warn(
    context: ApplicationContext,
    namespace: string,
    message: string,
    data?: unknown,
  ) {
    log.logMessage(context, 'warn', namespace, message, data);
  }

  public static error(
    context: ApplicationContext,
    namespace: string,
    message: string,
    data?: unknown,
  ) {
    log.logMessage(context, 'error', namespace, message, data);
  }

  public static debug(
    context: ApplicationContext,
    namespace: string,
    message: string,
    data?: unknown,
  ) {
    log.logMessage(context, 'debug', namespace, message, data);
  }
}
