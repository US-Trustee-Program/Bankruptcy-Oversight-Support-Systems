import { Attorney } from './attorneys';

describe('Attorney Info test', () => {
  test('should get first and last name', async () => {
    const attorney = new Attorney('First', 'Last', 'Manhattan');
    expect(attorney.getFullName()).toEqual('First Last');
  });

  test('should get first, middle initial, and last name', async () => {
    const attorney = new Attorney('First', 'Last', 'Manhattan', { middleName: 'Middle' });
    expect(attorney.getFullName()).toEqual('First M Last');
  });

  test('should get first, middle initial, last name, and generation', async () => {
    const attorney = new Attorney('First', 'Last', 'Manhattan', {
      middleName: 'Middle',
      generation: 'Jr.',
    });
    expect(attorney.getFullName()).toEqual('First M Last Jr.');
  });

  test('should get first, last name, and generation', async () => {
    const attorney = new Attorney('First', 'Last', 'Manhattan', {
      generation: 'Jr.',
    });
    expect(attorney.getFullName()).toEqual('First Last Jr.');
  });

  test('should get first, middle name, last name, and generation', async () => {
    const attorney = new Attorney('First', 'Last', 'Manhattan', {
      middleName: 'Middle',
      generation: 'Jr.',
    });
    expect(attorney.getFullName(true)).toEqual('First Middle Last Jr.');
  });
});
