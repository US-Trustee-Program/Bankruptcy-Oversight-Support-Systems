import { Context } from '../types/basic';

export default class log {
  private static sanitize(input: string): string {
    // let output = input.replace(/[\r\n]/g, '&x0D;&x0A;');
    // output = input.replace(/[\n]/g, '&x0A;');
    // return output;
    return input.replace(/[\n]/g, '\\n').replace(/[\r]/g, '\\r');
  }

  private static logMessage(context: Context, logType: string, namespace: string, message: string, data?: any) {
    let logString = `[${logType.toUpperCase()}] [${namespace}] ${message} ${undefined != data ? JSON.stringify(data) : ''}`;
    context.log(log.sanitize(logString.trim()));
  }

  public static info(context: Context, namespace: string, message: string, data?: any) {
    log.logMessage(context, 'info', namespace, message, data);
  }

  public static warn(context: Context, namespace: string, message: string, data?: any) {
    log.logMessage(context, 'warn', namespace, message, data);
  }

  public static error(context: Context, namespace: string, message: string, data?: any) {
    log.logMessage(context, 'error', namespace, message, data);
  }

  public static debug(context: Context, namespace: string, message: string, data?: any) {
    log.logMessage(context, 'debug', namespace, message, data);
  }
}
