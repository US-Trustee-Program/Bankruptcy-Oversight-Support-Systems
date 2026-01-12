import { ApplicationContext } from '../../adapters/types/basic';
import { CourtDivisionDetails, ustpOfficeToCourtDivision } from '@common/cams/courts';
import { OfficesUseCase } from '../offices/offices';

export class CourtsUseCase {
  public async getCourts(context: ApplicationContext): Promise<CourtDivisionDetails[]> {
    const officesUseCase = new OfficesUseCase();
    const offices = await officesUseCase.getOffices(context);
    const courts = [];
    offices.forEach((office) => {
      courts.push(...ustpOfficeToCourtDivision(office));
    });
    return courts;
  }
}
