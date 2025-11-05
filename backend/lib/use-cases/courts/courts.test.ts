import { CourtsUseCase } from './courts';
import { ApplicationContext } from '../application.types';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OfficesUseCase } from '../offices/offices';
import { MOCKED_USTP_OFFICES_ARRAY } from '../../../../common/src/cams/offices';
import { ustpOfficeToCourtDivision } from '../../../../common/src/cams/courts';

describe('Courts use case tests', () => {
  let useCase: CourtsUseCase;
  let context: ApplicationContext;

  beforeEach(async () => {
    useCase = new CourtsUseCase();
    context = await createMockApplicationContext();
  });

  test('should get courts', async () => {
    jest.spyOn(OfficesUseCase.prototype, 'getOffices').mockResolvedValue(MOCKED_USTP_OFFICES_ARRAY);
    const expected = MOCKED_USTP_OFFICES_ARRAY.reduce((acc, office) => {
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
