import { CaseListDbResult } from '../adapters/types/cases';
import { PacerGatewayInterface } from './pacer.gateway.interface';
import { getPacerGateway } from '../../factory';
import { Context } from '../adapters/types/basic';

namespace UseCases {

  export class Chapter15CaseList {
    pacerGateway: PacerGatewayInterface;

    constructor(pacerGateway?:PacerGatewayInterface) {
      if(pacerGateway != undefined)
      {
        this.pacerGateway = pacerGateway;
      }
      else{
        this.pacerGateway = getPacerGateway();
      }

    }

    async getChapter15CaseList(context: Context): Promise<CaseListDbResult> {
      try {
        let startingMonth = parseInt(process.env.STARTING_MONTH);
        if (startingMonth > 0) {
          startingMonth = 0 - startingMonth;
        }
        const cases = await this.pacerGateway.getChapter15Cases(context, startingMonth || undefined);

        return {
          success: true,
          message: '',
          count: 0,
          body: {
            caseList: cases,
          }
        }

      } catch (e) {
        const message = (e as Error).message;
        return{
          success: false,
          message: (message && message.length) ? message : 'Unknown Error received from PACER server',
          count: 0,
          body: {
            caseList: []
          }
        }
      }

    }
  }

}

export default UseCases.Chapter15CaseList;
