import { CasesInterface } from '../../use-cases/cases.interface';
import { ApplicationContext } from '../types/basic';
import { Chapter15CaseInterface } from '../types/cases';
import { GatewayHelper } from './gateway-helper';
import log from '../services/logger.service';
import { convertYearMonthDayToMonthDayYear } from '../utils/date-helper';

const NAMESPACE = 'CASES-LOCAL-GATEWAY';

export class CasesLocalGateway implements CasesInterface {
  getChapter15Cases = async (
    context: ApplicationContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options: {
      startingMonth?: number;
    },
  ): Promise<Chapter15CaseInterface[]> => {
    const gatewayHelper = new GatewayHelper();
    let cases: Chapter15CaseInterface[];

    try {
      cases = gatewayHelper.chapter15MockExtract();
      cases.map((bCase) => {
        bCase.dateFiled = convertYearMonthDayToMonthDayYear(bCase.dateFiled);
      });
    } catch (err) {
      log.error(context, NAMESPACE, 'Failed to read mock cases.', err);
      const message = (err as Error).message;
      return Promise.reject(message);
    }

    return cases;
  };
}
