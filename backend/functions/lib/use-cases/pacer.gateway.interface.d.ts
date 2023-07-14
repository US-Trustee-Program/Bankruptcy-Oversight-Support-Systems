import { Chapter15Case } from '../adapters/types/cases';
import { ApplicationContext } from '../adapters/types/basic';

export interface PacerGatewayInterface {
  getChapter15Cases(context: ApplicationContext, startingMonth?: number): Promise<Chapter15Case[]>;
}
