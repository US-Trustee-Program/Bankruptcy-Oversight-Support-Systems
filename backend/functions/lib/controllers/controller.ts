import { ApplicationContext } from '../adapters/types/basic';
import { CamsHttpResponseInit } from '../adapters/utils/http-response';

export interface CamsController {
  handleRequest(context: ApplicationContext): Promise<CamsHttpResponseInit<object | undefined>>;
}
