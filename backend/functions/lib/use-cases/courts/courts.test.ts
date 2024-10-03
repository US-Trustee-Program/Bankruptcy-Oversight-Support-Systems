import { CourtsUseCase } from './courts';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OfficesUseCase } from '../offices/offices';
import { USTP_OFFICES_ARRAY } from '../../../../../common/src/cams/offices';
import { ustpOfficeToCourtDivision } from '../../../../../common/src/cams/courts';

describe('Courts use case tests', () => {
  let useCase: CourtsUseCase;
  let context: ApplicationContext;

  beforeEach(async () => {
    useCase = new CourtsUseCase();
    context = await createMockApplicationContext();
  });

  test('should get courts', async () => {
    jest.spyOn(OfficesUseCase.prototype, 'getOffices').mockResolvedValue(USTP_OFFICES_ARRAY);
    const expected = USTP_OFFICES_ARRAY.reduce((acc, office) => {
      acc.push(...ustpOfficeToCourtDivision(office));
      return acc;
    }, []);

    const courts = await useCase.getCourts(context);
    expect(courts).toEqual(expected);
  });

  test('should throw errors when errors are encountered', async () => {
    const errorMessage = 'TestError';
    jest.spyOn(OfficesUseCase.prototype, 'getOffices').mockRejectedValue(new Error(errorMessage));

    await expect(useCase.getCourts(context)).rejects.toThrow(errorMessage);
  });
});
