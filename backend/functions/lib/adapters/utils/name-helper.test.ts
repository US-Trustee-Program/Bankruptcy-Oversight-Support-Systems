import { getFullName } from './name-helper';

describe('Name helper tests', () => {
  test('should get first and last name', async () => {
    expect(getFullName({ firstName: 'First', lastName: 'Last' })).toEqual('First Last');
  });

  test('should get first, middle initial and last name', async () => {
    expect(getFullName({ firstName: 'First', middleName: 'Middle', lastName: 'Last' })).toEqual(
      'First M Last',
    );
  });

  test('should get first, middle initial, last name, and generation', async () => {
    expect(
      getFullName({
        firstName: 'First',
        middleName: 'Middle',
        lastName: 'Last',
        generation: 'Jr.',
      }),
    ).toEqual('First M Last Jr.');
  });

  test('should get first, last name, and generation', async () => {
    expect(
      getFullName({
        firstName: 'First',
        lastName: 'Last',
        generation: 'Jr.',
      }),
    ).toEqual('First Last Jr.');
  });

  test('should get first, middle name, last name, and generation', async () => {
    expect(
      getFullName(
        {
          firstName: 'First',
          middleName: 'Middle',
          lastName: 'Last',
          generation: 'Jr.',
        },
        true,
      ),
    ).toEqual('First Middle Last Jr.');
  });

  test('should get first, middle name, last name, and generation', async () => {
    expect(
      getFullName(
        {
          firstName: '',
          lastName: '',
        },
        true,
      ),
    ).toEqual('');
  });
});
