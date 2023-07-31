import { PacerCaseData } from '../types/pacer';
import * as fs from 'fs';
import { IChapter15Case } from '../types/cases';

export class GatewayHelper {
  pacerMockExtract(): PacerCaseData[] {
    const filename = './lib/testing/mock-data/pacer-data.mock.json';

    try {
      const data = fs.readFileSync(filename, 'utf-8');
      const jsonData = JSON.parse(data);
      return jsonData.content;
    } catch (err) {
      throw Error(err);
    }
  }

  chapter15MockExtract(): IChapter15Case[] {
    const filename = './lib/testing/mock-data/chapter-15-cases.mock.json';

    try {
      const data = fs.readFileSync(filename, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      throw Error(err);
    }
  }
}
