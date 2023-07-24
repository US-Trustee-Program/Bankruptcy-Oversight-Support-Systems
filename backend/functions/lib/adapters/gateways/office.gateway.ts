import { Office } from '../types/office';

export interface IOfficeGateway {
  getOffice(professionalId: string): Promise<Office>;
}