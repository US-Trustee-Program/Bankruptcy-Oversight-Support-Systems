export class Office {
  private _courtId: string; //varchar(4)
  private _officeCode: string; //char(1)
  private _officeName: string; //varchar(110)

  get courtId(): string {
    return this._courtId;
  }

  set courtId(value: string) {
    this._courtId = value;
  }

  get officeCode(): string {
    return this._officeCode;
  }

  set officeCode(value: string) {
    this._officeCode = value;
  }

  get officeName(): string {
    return this._officeName;
  }

  set officeName(value: string) {
    this._officeName = value;
  }
}
