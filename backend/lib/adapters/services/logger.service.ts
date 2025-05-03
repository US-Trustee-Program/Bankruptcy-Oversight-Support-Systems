import { CamsError } from '../../common-errors/cams-error';

export interface LoggerHelper {
  camsError: (error: CamsError) => void;
  debug: (moduleName: string, message: string, data?: unknown) => void;
  error: (moduleName: string, message: string, data?: unknown) => void;
  info: (moduleName: string, message: string, data?: unknown) => void;
  warn: (moduleName: string, message: string, data?: unknown) => void;
}

type LoggerProvider = Console['log'];
type LogType = 'debug' | 'error' | 'info' | 'warn';

const disallowedProperties = ['ssn', 'taxId', 'ein', 'itin'];

export class LoggerImpl implements LoggerHelper {
  private readonly invocationId: string;
  private readonly provider: LoggerProvider;

  constructor(invocationId: string, provider: LoggerProvider = console.log) {
    this.provider = provider;
    this.invocationId = invocationId;
  }

  camsError(camsError: CamsError) {
    this.logMessage('error', camsError.module, camsError.message, camsError);
  }

  debug(moduleName: string, message: string, data?: unknown) {
    this.logMessage('debug', moduleName, message, data);
  }

  error(moduleName: string, message: string, data?: unknown) {
    this.logMessage('error', moduleName, message, data);
  }

  info(moduleName: string, message: string, data?: unknown) {
    this.logMessage('info', moduleName, message, data);
  }

  warn(moduleName: string, message: string, data?: unknown) {
    this.logMessage('warn', moduleName, message, data);
  }

  private logMessage(logType: LogType, moduleName: string, message: string, data?: unknown) {
    const logString = `[${logType.toUpperCase()}] [${moduleName}] [INVOCATION ${this.invocationId}] ${this.scrubMessage(message)} ${
      undefined != data
        ? JSON.stringify(data, (key, value) => {
            let disallowed = false;
            disallowedProperties.forEach((prop) => {
              if (key.localeCompare(prop, undefined, { sensitivity: 'accent' }) === 0) {
                disallowed = true;
              }
            });
            return disallowed ? undefined : value;
          })
        : ''
    }`;
    this.provider(this.sanitize(logString.trim()));
  }

  private sanitize(input: string): string {
    return input.replace(/[\r\n]+/g, ' ').trim();
  }

  private scrubMessage(message: string) {
    const piiRegex = /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b|\b\d{2}[- ]?\d{7}\b/gm;
    return message.replace(piiRegex, '[REDACTED]');
  }
}
