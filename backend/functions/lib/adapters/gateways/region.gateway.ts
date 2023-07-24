import { Region } from '../types/region';

export interface IRegionGateway {
  getRegion(professionalId: string): Promise<Region>;
}
