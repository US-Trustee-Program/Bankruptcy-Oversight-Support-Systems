import { CamsError } from '../../common-errors/cams-error';
import { getOffice } from './offices.gateway';

describe('Office gateway', () => {
  test('should return the name of a known office by ID', () => {
    const office = getOffice('011');
    expect(office).toEqual('Boston');
  });
  test('should throw an error for an invalid ID', () => {
    const expectedException = new CamsError('OFFICES-GATEWAY', {
      message: "Cannot find office by id 'AAA'.",
      data: { id: 'AAA' },
    });
    expect(() => {
      getOffice('AAA');
    }).toThrow(expectedException);
  });
});
