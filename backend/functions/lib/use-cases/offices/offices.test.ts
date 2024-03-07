import { OfficesUseCase } from './offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OFFICES } from '../../../../../common/src/cams/test-utilities/offices.mock';

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
});
