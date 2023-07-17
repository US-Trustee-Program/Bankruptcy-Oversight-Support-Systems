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
    data?: any,
  ) {
    let logString = `[${logType.toUpperCase()}] [${namespace}] ${message} ${
      undefined != data ? JSON.stringify(data) : ''
    }`;
    context.log(log.sanitize(logString.trim()));
  }

  public static info(context: ApplicationContext, namespace: string, message: string, data?: any) {
    log.logMessage(context, 'info', namespace, message, data);
  }

  public static warn(context: ApplicationContext, namespace: string, message: string, data?: any) {
    log.logMessage(context, 'warn', namespace, message, data);
  }

  public static error(context: ApplicationContext, namespace: string, message: string, data?: any) {
    log.logMessage(context, 'error', namespace, message, data);
  }

  public static debug(context: ApplicationContext, namespace: string, message: string, data?: any) {
    log.logMessage(context, 'debug', namespace, message, data);
  }
}
