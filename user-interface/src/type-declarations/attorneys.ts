export class AttorneyInfo {
  firstName: string;
  middleName?: string;
  lastName: string;
  generation?: string;
  office: string;
  caseCount?: number;

  constructor(
    firstName: string,
    lastName: string,
    office: string,
    optionals?: { middleName?: string; generation?: string; caseCount?: number },
  ) {
    this.firstName = firstName;
    this.lastName = lastName;
    this.office = office;
    if (optionals) {
      this.middleName = optionals.middleName || undefined;
      this.generation = optionals.generation || undefined;
      this.caseCount = optionals.caseCount || undefined;
    }
  }
}

export class Attorney extends AttorneyInfo {
  constructor(
    first: string,
    last: string,
    office: string,
    optionals?: { middleName?: string; generation?: string; caseCount?: number },
  ) {
    super(first, last, office, optionals);
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
}
