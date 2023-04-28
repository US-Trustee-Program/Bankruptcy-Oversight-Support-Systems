import { LogContext } from '../types/basic';

export default class log {
  private static logMessage(context: LogContext, logType: string, namespace: string, message: string, data?: any) {
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

  public static info(context: LogContext, namespace: string, message: string, data?: any) {
    log.logMessage(context, 'info', namespace, message, data);
  }

  public static warn(context: LogContext, namespace: string, message: string, data?: any) {
    log.logMessage(context, 'warn', namespace, message, data);
  }

  public static error(context: LogContext, namespace: string, message: string, data?: any) {
    log.logMessage(context, 'error', namespace, message, data);
  }

  public static debug(context: LogContext, namespace: string, message: string, data?: any) {
    log.logMessage(context, 'debug', namespace, message, data);
  }
}
