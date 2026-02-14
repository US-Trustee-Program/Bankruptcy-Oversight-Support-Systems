import { ApplicationContext } from '../adapters/types/basic';
import { CamsHttpResponseInit } from '../adapters/utils/http-response';

export interface CamsController {
  handleRequest(context: ApplicationContext): Promise<CamsHttpResponseInit<object | undefined>>;
}

export interface CamsTimerController<T = void> {
  handleTimer(context: ApplicationContext): Promise<T>;
}
