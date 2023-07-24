import { IRegionGateway } from '../adapters/gateways/region.gateway';
import { IOfficeGateway } from '../adapters/gateways/office.gateway';
//add factory lines here
export class RegionAndOfficeService {
  _regionGateway: IRegionGateway;
  _officeGateway: IOfficeGateway;

  constructor(regionGateway?: IRegionGateway, officeGateway?: IOfficeGateway) {
    if (regionGateway == undefined) {
      this._regionGateway = getRegionGateway();
    } else {
      this._regionGateway = regionGateway;
    }
    if (officeGateway == undefined) {
      this._officeGateway = getOfficeGateway();
    } else {
      this._officeGateway = officeGateway;
    }
  }
}
