import { ObjectKeyVal } from './basic';

export class Attorney {
  firstName: string;
  middleName: string;
  lastName: string;
  generation: string;
  courtId: string;
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

  getFullName(fullMiddle = false) {
    let full = this.firstName;
    if (this.middleName) {
      const middle = fullMiddle ? ' ' + this.middleName : ' ' + this.middleName.slice(0, 1);
      full += middle;
    }
    full += ' ' + this.lastName;
    if (this.generation) {
      full += ' ' + this.generation;
    }
    return full;
  }

  getAsObjectKeyVal(): ObjectKeyVal {
    return {
      firstName: this.firstName,
      middleName: this.middleName,
      lastName: this.lastName,
      generation: this.generation,
      courtId: this.courtId,
      office: this.office,
      caseLoad: this.caseLoad,
    };
  }
}
