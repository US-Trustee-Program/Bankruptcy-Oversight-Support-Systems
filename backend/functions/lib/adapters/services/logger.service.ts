import { CamsError } from '../../common-errors/cams-error';
import { Context } from '@azure/functions';
import { LoggerHelper } from '../types/basic';

type LoggerProvider = Console['log'] | Context['log'];
type LogType = 'debug' | 'info' | 'warn' | 'error';

export class LoggerImpl implements LoggerHelper {
  private provider: LoggerProvider;
  constructor(provider: LoggerProvider = console.log) {
    this.provider = provider;
  }
  private sanitize(input: string): string {
    return input.replace(/[\r\n]+/g, ' ').trim();
  }
  private logMessage(logType: LogType, moduleName: string, message: string, data?: unknown) {
    const logString = `[${logType.toUpperCase()}] [${moduleName}] ${message} ${
      undefined != data ? JSON.stringify(data) : ''
    }`;
    this.provider(this.sanitize(logString.trim()));
  }

  info(moduleName: string, message: string, data?: unknown) {
    this.logMessage('info', moduleName, message, data);
  }

  warn(moduleName: string, message: string, data?: unknown) {
    this.logMessage('warn', moduleName, message, data);
  }

  error(moduleName: string, message: string, data?: unknown) {
    this.logMessage('error', moduleName, message, data);
  }

  debug(moduleName: string, message: string, data?: unknown) {
    this.logMessage('debug', moduleName, message, data);
  }

  camsError(camsError: CamsError) {
    this.logMessage('error', camsError.module, camsError.message, camsError);
  }
}
