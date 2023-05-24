import { Context } from '../types/basic';

export default class log {
  private static sanitize(input: string): string {
    let output = input.replace(/[\r\n]/g, '&x0D;&x0A;');
    output = input.replace(/[\n]/g, '&x0A;');
    return output;
  }

  private static logMessage(context: Context, logType: string, namespace: string, message: string, data?: any) {
    let logString: string;
    logType = logType.toLowerCase();

    if (data) {
        logString = log.sanitize(`[${logType.toUpperCase()}] [${namespace}] ${message} ${undefined != data ? JSON.stringify(data) : ''}`);
    } else {
        logString = log.sanitize(`[${logType.toUpperCase()}] [${namespace}] ${message}`);
    }
    context.log(logString);
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
