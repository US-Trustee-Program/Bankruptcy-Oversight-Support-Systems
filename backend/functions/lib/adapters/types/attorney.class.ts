import { ObjectKeyVal } from './basic';
import { Person } from '../utils/name-helper';

export class Attorney implements Person {
  firstName: string;
  middleName: string;
  lastName: string;
  generation: string;
  office: string;
  caseLoad: number;

  constructor(attorney?: ObjectKeyVal) {
    if (attorney) {
      Object.entries(attorney).forEach(([key, value]) => {
        if (key === 'firstName') {
          this.firstName = value as string;
        } else if (key === 'middleName') {
          this.middleName = value as string;
        } else if (key === 'lastName') {
          this.lastName = value as string;
        } else if (key === 'generation') {
          this.generation = value as string;
        }
      });
    }
  }

  getAsObjectKeyVal(): ObjectKeyVal {
    return {
      firstName: this.firstName,
      middleName: this.middleName,
      lastName: this.lastName,
      generation: this.generation,
      office: this.office,
      caseLoad: this.caseLoad,
    };
  }
}
