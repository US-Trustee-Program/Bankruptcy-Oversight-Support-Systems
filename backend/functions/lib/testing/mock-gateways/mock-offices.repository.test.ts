import { createMockApplicationContext } from '../testing-utilities';
import { MockOfficesRepository } from './mock-offices.repository';

describe('MockOfficesRepository', () => {
  test('should return expected attorney lists by office code', async () => {
    const context = await createMockApplicationContext();
    const repo = new MockOfficesRepository();

    const nyAttys = await repo.getOfficeAttorneys(context, 'USTP_CAMS_Region_2_Office_Manhattan');
    expect(nyAttys.map((atty) => atty.name)).toEqual([
      'Jessica Pearson',
      'Jack McCoy',
      "Martha's Son",
    ]);

    const buAttys = await repo.getOfficeAttorneys(context, 'USTP_CAMS_Region_2_Office_Buffalo');
    expect(buAttys.map((atty) => atty.name)).toEqual([]);
  });
});
