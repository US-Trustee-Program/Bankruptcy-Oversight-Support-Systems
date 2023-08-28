import AttorneysApi from './attorneys-api';
import { ObjectKeyVal } from '../type-declarations/basic';
import { ResponseData } from '../type-declarations/api';

describe('Attorneys API test', () => {
  test('should return only the list of attorneys', async () => {
    vi.mock('./api', () => {
      return {
        default: {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          list: (path: string, options?: ObjectKeyVal): Promise<ResponseData> => {
            return Promise.resolve({
              message: '',
              count: 2,
              body: {
                attorneyList: [
                  {
                    firstName: 'Marilyn',
                    middleName: 'Jane',
                    lastName: 'Jenkins',
                    generation: '',
                    office: 'Manhattan',
                  },
                  {
                    firstName: 'Thomas',
                    middleName: 'Stephen',
                    lastName: 'Koenig',
                    generation: '',
                    office: 'Manhattan',
                  },
                ],
              },
            });
          },
        },
      };
    });

    const attorneys = await AttorneysApi.getAttorneys();
    expect(attorneys).toEqual([
      {
        firstName: 'Marilyn',
        middleName: 'Jane',
        lastName: 'Jenkins',
        generation: '',
        office: 'Manhattan',
      },
      {
        firstName: 'Thomas',
        middleName: 'Stephen',
        lastName: 'Koenig',
        generation: '',
        office: 'Manhattan',
      },
    ]);
  });
});
