import { PacerGatewayInterface } from '../../use-cases/pacer.gateway.interface';
import { Chapter15Case, PacerCaseData } from '../types/cases';
import { pacerToChapter15Data } from '../../interfaces/chapter-15-data-interface';
import * as fs from 'fs';

class PacerLocalGateway implements PacerGatewayInterface {
  getChapter15Cases = async (startingMonth: number): Promise<Chapter15Case[]> => {
    const filename = './lib/testing/mock-data/pacer-data.mock.json';
    let cases: Chapter15Case[];

    let chapter15CaseArray: PacerCaseData[] = [];
    try {
      const data = fs.readFileSync(filename, 'utf-8');
      const jsonData = JSON.parse(data);
      chapter15CaseArray = jsonData.content;
      cases = pacerToChapter15Data(chapter15CaseArray);
    } catch (err) {
      const message = (err as Error).message;
      return Promise.reject(message);
    }

    return cases;
  }
}

export { PacerLocalGateway }
