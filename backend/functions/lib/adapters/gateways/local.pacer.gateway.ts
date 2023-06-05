import { PacerGatewayInterface } from '../../use-cases/pacer.gateway.interface';
import { Chapter15Case } from '../types/cases';

class LocalPacerGateway implements PacerGatewayInterface {
  async getChapter15Cases(startingMonth: number): Promise<Chapter15Case[]> {
    let chapter15Case: Chapter15Case = {
      caseNumber: "22-44449",
      caseTitle: "Flo Esterly and Neas Van Sampson",
      dateFiled: "2005-05-04",
    };

    const chapter15CaseArray: Chapter15Case[] = [chapter15Case];

    return chapter15CaseArray;
  }
}

export { LocalPacerGateway }
