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
      this.middleName = optionals.middleName || undefined;
      this.generation = optionals.generation || undefined;
      this.caseLoad = optionals.caseLoad || undefined;
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
