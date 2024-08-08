import { OfficesUseCase } from './offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MANHATTAN, OFFICES } from '../../../../../common/src/cams/test-utilities/offices.mock';
import * as factoryModule from '../../factory';

describe('offices use case tests', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
  });

  test('should return offices', async () => {
    const useCase = new OfficesUseCase();

    const offices = await useCase.getOffices(applicationContext);

    expect(offices).toEqual(OFFICES);
  });

  test('should return offices by office code and court id', async () => {
    const useCase = new OfficesUseCase();
    const getOfficeByCourtIdAndOfficeCode = jest.fn().mockResolvedValue([MANHATTAN]);
    const mockOfficesGateway = jest
      .fn()
      .mockImplementation((_applicationContext: ApplicationContext) => {
        return {
          getOfficeName: jest.fn(),
          getOffices: jest.fn(),
          getOfficeByCourtIdAndOfficeCode,
        };
      });
    jest.spyOn(factoryModule, 'getOfficesGateway').mockImplementation(mockOfficesGateway);

    const courtId = 'ABCD';
    const officeCode = '1';
    const offices = await useCase.getOfficesByCourtIdAndOfficeCode(
      applicationContext,
      courtId,
      officeCode,
    );

    expect(offices).toEqual([MANHATTAN]);
    expect(getOfficeByCourtIdAndOfficeCode).toHaveBeenCalledWith(
      applicationContext,
      courtId,
      officeCode,
    );
  });
});
