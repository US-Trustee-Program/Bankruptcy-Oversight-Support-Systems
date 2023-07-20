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

  private readonly functionContext: ApplicationContext;

  constructor(functionContext: ApplicationContext) {
    this.functionContext = functionContext;
  }

  public info(namespace: string, message: string, data?: unknown) {
    log.info(this.functionContext, namespace, message, data);
  }

  public warn(namespace: string, message: string, data?: unknown) {
    log.warn(this.functionContext, namespace, message, data);
  }

  public error(namespace: string, message: string, data?: unknown) {
    log.error(this.functionContext, namespace, message, data);
  }

  public debug(namespace: string, message: string, data?: unknown) {
    log.debug(this.functionContext, namespace, message, data);
  }
}
