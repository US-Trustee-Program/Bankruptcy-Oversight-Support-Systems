import { ApplicationContext } from '../use-cases/application.types';
import { CamsHttpResponseInit } from '../adapters/utils/http-response';

export interface CamsController {
  handleRequest(context: ApplicationContext): Promise<CamsHttpResponseInit<object | undefined>>;
}

export interface CamsTimerController {
  handleTimer(context: ApplicationContext): Promise<void>;
}
