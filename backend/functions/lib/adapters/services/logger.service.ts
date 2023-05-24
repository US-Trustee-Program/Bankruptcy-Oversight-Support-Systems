import { Context } from '../types/basic';

export default class log {
  private static sanitize(input: string): string {
    let output = input.replace(/[\r\n]/g, '&x0D;&x0A;');
    output = input.replace(/[\n]/g, '&x0A;');
    return output;
  }

  private static logMessage(context: Context, logType: string, namespace: string, message: string, data?: any) {
    logType = logType.toLowerCase();

    if (data) {
        context.log(`[${log.sanitize(logType.toUpperCase())}] [${log.sanitize(namespace)}] ${log.sanitize(message)} ${undefined != data ? log.sanitize(JSON.stringify(data)) : ''}`);
    } else {
        context.log(log.sanitize(`[${logType.toUpperCase()}] [${namespace}] ${message}`));
    }
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
