import { Chapter15Case } from '../adapters/types/cases';
import { ApplicationContext } from '../adapters/types/basic';

export interface CasesInterface {
  getChapter15Cases(context: ApplicationContext, startingMonth?: number): Promise<Chapter15Case[]>;
}
