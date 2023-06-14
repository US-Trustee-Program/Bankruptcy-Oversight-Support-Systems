/*
 1. Call the PacerLoginUseCase to get a valid Auth token for pacer.
 */

import { Context } from '../types/basic';

class PacerLoginController{

  private readonly functionContext: Context;

  constructor(context: Context) {
    this.functionContext = context;
  }

  private async getToken() : Promise<string>{
    return await useCase.getPacerToken(this.functionContext);
  }

}