import { CasesInterface } from '../../use-cases/cases.interface';
import { IChapter15Case } from '../types/cases';
import { pacerToChapter15Data } from '../../interfaces/chapter-15-data-interface';
import { GatewayHelper } from './gateway-helper';

class PacerLocalGateway implements CasesInterface {
  startingMonth: number;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getChapter15Cases = async (
    context,
    options: { startingMonth?: number; gatewayHelper?: GatewayHelper },
  ): Promise<IChapter15Case[]> => {
    const _gatewayHelper = options.gatewayHelper || new GatewayHelper();
    this.startingMonth = options.startingMonth || -6;
    let cases: IChapter15Case[];

    try {
      cases = pacerToChapter15Data(_gatewayHelper.pacerMockExtract());
    } catch (err) {
      const message = (err as Error).message;
      return Promise.reject(message);
    }

    return cases;
  };
}

export { PacerLocalGateway };
