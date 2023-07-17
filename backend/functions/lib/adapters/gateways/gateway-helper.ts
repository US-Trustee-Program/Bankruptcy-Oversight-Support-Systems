import { PacerCaseData } from '../types/pacer';
import * as fs from 'fs';
import { Chapter15Case } from '../types/cases';

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

  chapter15MockExtract(): Chapter15Case[] {
    const filename = './lib/testing/mock-data/chapter-15-cases.mock.json';

    try {
      const data = fs.readFileSync(filename, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      throw Error(err);
    }
  }

  calculateDifferenceInMonths(left: Date, right: Date): number {
    let earlier, later: Date;
    if (left.getFullYear() < right.getFullYear()) {
      earlier = left;
      later = right;
    } else if (left.getFullYear() > right.getFullYear()) {
      earlier = right;
      later = left;
    } else if (left.getMonth() < right.getMonth()) {
      earlier = left;
      later = right;
    } else if (left.getMonth() > right.getMonth()) {
      earlier = right;
      later = left;
    } else {
      return 0;
    }
    const years = Math.abs(earlier.getFullYear() - later.getFullYear());
    const incompleteYear = later.getMonth() < earlier.getMonth();
    const months = later.getMonth() - earlier.getMonth();
    const realMonths = months < 0 ? 12 + months : months;
    const incompleteMonth = later.getDate() < earlier.getDate();
    const monthsDiff = incompleteYear ? years * 12 + realMonths - 12 : years * 12 + realMonths;
    return incompleteMonth ? monthsDiff - 1 : monthsDiff;
  }
}
