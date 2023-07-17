import { CasesInterface } from '../../use-cases/cases.interface';
import { ApplicationContext } from '../types/basic';
import { Chapter15Case } from '../types/cases';
import { GatewayHelper } from './gateway-helper';
import log from '../services/logger.service';

const NAMESPACE = 'CASES-LOCAL-GATEWAY';

export class CasesLocalGateway implements CasesInterface {
  getChapter15Cases = async (
    context: ApplicationContext,
    startingMonth: number = -6,
  ): Promise<Chapter15Case[]> => {
    let cases: Chapter15Case[];
    const date = new Date();
    date.setMonth(date.getMonth() + startingMonth);
    const dateFiledFrom = date.toISOString().split('T')[0];

    try {
      const gatewayHelper = new GatewayHelper();
      cases = gatewayHelper.chapter15MockExtract();
      cases = cases.filter((bCase) => bCase.dateFiled > dateFiledFrom);
    } catch (err) {
      log.error(context, NAMESPACE, 'Failed to read mock cases.', err);
      const message = (err as Error).message;
      return Promise.reject(message);
    }

    return cases;
  };
}
