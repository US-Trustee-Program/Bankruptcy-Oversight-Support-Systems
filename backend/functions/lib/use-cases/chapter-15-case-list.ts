import { CaseListDbResult } from '../adapters/types/cases';
import { Context } from '../adapters/types/basic';
import { PacerGatewayInterface } from './pacer.gateway.interface';
import { getPacerGateway } from '../../factory';
import { PacerApiGateway } from '../adapters/gateways/pacer.api.gateway';

namespace UseCases {

  export class Chapter15CaseList {
    pacerGateway: PacerGatewayInterface;

    constructor() {
      this.pacerGateway = getPacerGateway();
    }

    async getChapter15CaseList(context: Context): Promise<CaseListDbResult> {
      // connect to API via PACER gateway
      // get chapter 15 records from pacer
      try {
        const cases = await this.pacerGateway.getChapter15Cases();

        // build CaseListDbResult object
        // return results
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
