export class AttorneyInfo {
  firstName: string;
  middleName?: string;
  lastName: string;
  generation?: string;
  office: string;
  caseLoad?: number;

  constructor(
    firstName: string,
    lastName: string,
    office: string,
    optionals?: { middleName?: string; generation?: string; caseLoad?: number },
  ) {
    this.firstName = firstName;
    this.lastName = lastName;
    this.office = office;
    if (optionals) {
      this.middleName = optionals.middleName;
      this.generation = optionals.generation;
      this.caseLoad = optionals.caseLoad;
    }
  }
}

export class Attorney extends AttorneyInfo {
  constructor(
    first: string,
    last: string,
    office: string,
    optionals?: { middleName?: string; generation?: string; caseLoad?: number },
  ) {
    super(first, last, office, optionals);
  }
}
