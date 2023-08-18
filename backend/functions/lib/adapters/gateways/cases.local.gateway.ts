import { CasesInterface } from '../../use-cases/cases.interface';
import { ApplicationContext } from '../types/basic';
import { Chapter15CaseInterface } from '../types/cases';
import { GatewayHelper } from './gateway-helper';
import log from '../services/logger.service';
import { getCamsDateStringFromDate } from '../utils/date-helper';

const NAMESPACE = 'CASES-LOCAL-GATEWAY';

export class CasesLocalGateway implements CasesInterface {
  getChapter15Cases = async (
    context: ApplicationContext,
    options: {
      startingMonth?: number;
      gatewayHelper?: GatewayHelper;
    },
  ): Promise<Chapter15CaseInterface[]> => {
    const _gatewayHelper = options.gatewayHelper || new GatewayHelper();
    let cases: Chapter15CaseInterface[];
    const date = new Date();
    date.setMonth(date.getMonth() + (options.startingMonth || -6));
    const dateFiledFrom = getCamsDateStringFromDate(date);

    try {
      cases = _gatewayHelper.chapter15MockExtract();
      cases = cases.filter((bCase) => bCase.dateFiled >= dateFiledFrom);
    } catch (err) {
      log.error(context, NAMESPACE, 'Failed to read mock cases.', err);
      const message = (err as Error).message;
      return Promise.reject(message);
    }

    return cases;
  };
}
