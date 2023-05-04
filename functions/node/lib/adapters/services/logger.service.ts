import { Context } from '../types/basic';

export default class log {
  private static logMessage(context: Context, logType: string, namespace: string, message: string, data?: any) {
    logType = logType.toLowerCase();

    if (!['info', 'warn', 'error', 'debug'].includes(logType)) {
        throw new Error(`Log type ${logType} must be 'info', 'warn', 'error', or 'debug'`);
    }

    if (data) {
        context.log(`[${logType.toUpperCase()}] [${namespace}] ${message} ${undefined != data ? JSON.stringify(data) : ''}`);
    } else {
        context.log(`[${logType.toUpperCase}] [${namespace}] ${message}`);
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
