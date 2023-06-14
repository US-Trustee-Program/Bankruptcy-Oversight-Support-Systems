/*
 1. Call the PacerLoginUseCase to get a valid Auth token for pacer.
 */

import { Context } from '../types/basic';

export class PacerLoginController {

  private readonly functionContext: Context;

  constructor(context: Context) {
    this.functionContext = context;
  }

  public async getToken() : Promise<string>{
    return await useCase.getPacerToken(this.functionContext);
  }

}
