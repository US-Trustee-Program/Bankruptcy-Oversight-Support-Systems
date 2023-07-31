import { IChapter15Case } from '../adapters/types/cases';
import { ApplicationContext } from '../adapters/types/basic';
import { GatewayHelper } from '../adapters/gateways/gateway-helper';

export interface CasesInterface {
  getChapter15Cases(
    context: ApplicationContext,
    options: { startingMonth?: number; gatewayHelper?: GatewayHelper },
  ): Promise<IChapter15Case[]>;
}
