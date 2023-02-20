const consoleMap = {
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

type ObjectKey = keyof typeof consoleMap;

const getTimeStamp = (): string => {
  return new Date().toISOString();
};

export default function log(logType: string, namespace: string, message: string, object?: any) {
  logType = logType.toLowerCase();

  if (!['info', 'warn', 'error', 'debug'].includes(logType)) {
    throw new Error(`Log type ${logType} must be 'info', 'warn', 'error', or 'debug'`);
  }

  if (object) {
    consoleMap[logType as ObjectKey](`[${getTimeStamp()}] [${logType.toUpperCase()}] [${namespace}] ${message}`, object);
  } else {
    consoleMap[logType as ObjectKey](`[${getTimeStamp()}] [${logType.toUpperCase}] [${namespace}] ${message}`);
  }
}
