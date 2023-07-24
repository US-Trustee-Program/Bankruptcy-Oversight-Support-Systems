export class Region {
  private _regionId: string; //varchar(2)
  private _regionName: string; //varchar(20)

  get regionId(): string {
    return this._regionId;
  }

  set regionId(value: string) {
    this._regionId = value;
  }

  get regionName(): string {
    return this._regionName;
  }

  set regionName(value: string) {
    this._regionName = value;
  }
}
