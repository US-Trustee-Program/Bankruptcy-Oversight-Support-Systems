//import pine from 'pine';
const pine = require('pine');

const logger = pine();

const consoleMap = {
  info: logger.info,
  warn: logger.warn,
  error: logger.error,
  debug: logger.debug,
};

type ObjectKey = keyof typeof consoleMap;

export default class log {
  private static logMessage(logType: string, namespace: string, message: string, data?: any) {
    logType = logType.toLowerCase();

    if (!['info', 'warn', 'error', 'debug'].includes(logType)) {
        throw new Error(`Log type ${logType} must be 'info', 'warn', 'error', or 'debug'`);
    }

    if (data) {
        consoleMap[logType as ObjectKey](`[${logType.toUpperCase()}] [${namespace}] ${message} ${undefined != data ? JSON.stringify(data) : ''}`);
    } else {
        consoleMap[logType as ObjectKey](`[${logType.toUpperCase}] [${namespace}] ${message}`);
    }
  }

  public static info(namespace: string, message: string, data?: any) {
    log.logMessage('info', namespace, message, data);
  }

  public static warn(namespace: string, message: string, data?: any) {
    log.logMessage('warn', namespace, message, data);
  }

  public static error(namespace: string, message: string, data?: any) {
    log.logMessage('error', namespace, message, data);
  }

  public static debug(namespace: string, message: string, data?: any) {
    log.logMessage('debug', namespace, message, data);
  }
}
