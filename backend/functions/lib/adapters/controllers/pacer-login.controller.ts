import { Context } from '../types/basic';
import useCase from '../../use-cases/index';

export class PacerLoginController {

  private readonly functionContext: Context;

  constructor(context: Context) {
    this.functionContext = context;
  }

  public async getToken() : Promise<string>{
    return await useCase.getPacerToken(this.functionContext);
  }

}
