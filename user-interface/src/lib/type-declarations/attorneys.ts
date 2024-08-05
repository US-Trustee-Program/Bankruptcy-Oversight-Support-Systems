export class AttorneyInfo {
  firstName: string;
  middleName?: string;
  lastName: string;
  generation?: string;
  office: string;
  caseLoad?: number;
  userId?: string;
  userName?: string;

  constructor(
    firstName: string,
    lastName: string,
    office: string,
    optionals?: {
      middleName?: string;
      generation?: string;
      caseLoad?: number;
      userId?: string;
      userName?: string;
    },
  ) {
    this.firstName = firstName;
    this.lastName = lastName;
    this.office = office;
    if (optionals) {
      this.middleName = optionals.middleName;
      this.generation = optionals.generation;
      this.caseLoad = optionals.caseLoad;
      this.userId = optionals.userId ?? '';
      this.userName = optionals.userName ?? '';
    }
  }
}

export class Attorney extends AttorneyInfo {
  constructor(
    first: string,
    last: string,
    office: string,
    optionals?: {
      middleName?: string;
      generation?: string;
      caseLoad?: number;
      userId?: string;
      userName?: string;
    },
  ) {
    super(first, last, office, optionals);
  }
}
