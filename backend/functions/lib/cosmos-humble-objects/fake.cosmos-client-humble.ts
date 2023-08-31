import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';

export default class FakeCosmosClientHumble {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public database(id: string) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      container: (id: string) => {
        return {
          items: () => {
            return {
              create: (assignment: CaseAttorneyAssignment) => {
                return {
                  item: {
                    id: 'some-id',
                    ...assignment,
                  },
                };
              },
            };
          },
        };
      },
    };
  }
}
