import { OfficesUseCase } from './offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OFFICES } from '../../../../../common/src/cams/test-utilities/offices.mock';
import * as factory from '../../factory';

describe('offices use case tests', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
  });

  test('should return offices', async () => {
    const useCase = new OfficesUseCase();

    const offices = await useCase.getOffices(applicationContext);

    expect(offices).toEqual(OFFICES);
  });

  test('should return attorneys', async () => {
    const useCase = new OfficesUseCase();
    const repoSpy = jest.fn().mockResolvedValue([]);
    jest.spyOn(factory, 'getOfficesRepository').mockImplementation(() => {
      return {
        putOfficeStaff: jest.fn(),
        getOfficeAttorneys: repoSpy,
      };
    });

    const officeCode = 'new-york';
    const officeAttorneys = await useCase.getOfficeAttorneys(applicationContext, officeCode);
    expect(officeAttorneys).toEqual([]);
    expect(repoSpy).toHaveBeenCalledWith(applicationContext, officeCode);
  });
});
