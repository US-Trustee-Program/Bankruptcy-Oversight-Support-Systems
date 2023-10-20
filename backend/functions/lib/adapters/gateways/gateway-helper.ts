import * as fs from 'fs';
import { CaseDetailInterface } from '../types/cases';

export class GatewayHelper {
  chapter15MockExtract(): CaseDetailInterface[] {
    const filename = './lib/testing/mock-data/chapter-15-cases.mock.json';

    try {
      const data = fs.readFileSync(filename, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      throw Error(err);
    }
  }
}
