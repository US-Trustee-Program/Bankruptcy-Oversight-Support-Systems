import { PacerGatewayInterface } from '../../use-cases/pacer.gateway.interface';
import { PacerCaseData } from '../types/cases';
import * as fs from 'fs';

class PacerLocalGateway implements PacerGatewayInterface {
  getChapter15Cases = async (startingMonth: number): Promise<PacerCaseData[]> => {
    const filename = './lib/testing/mock-data/pacer-data.mock.json';

    let chapter15CaseArray: PacerCaseData[] = [];
    try {
      const data = fs.readFileSync(filename, 'utf-8');
      const jsonData = JSON.parse(data);
      chapter15CaseArray = jsonData.content;
    } catch (err) {
      console.log(`Error reading JSON file: ${err}`);
    }

    return chapter15CaseArray;
  }
}

export { PacerLocalGateway }
