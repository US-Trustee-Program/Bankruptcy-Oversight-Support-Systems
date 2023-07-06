
export class Attorney{

  private _firstName: string;
  private _middleName: string;
  private _lastName: string;
  private _courtId: string;
  private _generation: string;
  private _office: string;

  get firstName(): string {
    return this._firstName;
  }

  set firstName(value: string) {
    this._firstName = value;
  }

  get middleName(): string {
    return this._middleName;
  }

  set middleName(value: string) {
    this._middleName = value;
  }

  get lastName(): string {
    return this._lastName;
  }

  set lastName(value: string) {
    this._lastName = value;
  }

  get courtId(): string {
    return this._courtId;
  }

  set courtId(value: string) {
    this._courtId = value;
  }

  get generation(): string {
    return this._generation;
  }

  set generation(value: string) {
    this._generation = value;
  }

  get office(): string {
    return this._office;
  }

  set office(value: string) {
    this._office = value;
  }

}