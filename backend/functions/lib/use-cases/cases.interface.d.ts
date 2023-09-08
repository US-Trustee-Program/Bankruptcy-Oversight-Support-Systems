import { Chapter15CaseInterface } from '../adapters/types/cases';
import { ApplicationContext } from '../adapters/types/basic';

export interface CasesInterface {
  getChapter15Cases(
    context: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<Chapter15CaseInterface[]>;
}
