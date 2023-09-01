import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';

interface QueryParams {
  name: string;
  value: string;
}

interface QueryOptions {
  query: string;
  parameters: QueryParams[];
}

export default class FakeCosmosClientHumble {
  private caseAssignments: CaseAttorneyAssignment[] = [];
  private itemQueryParams: QueryParams[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public database(databaseId: string) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      container: (containerId: string) => {
        return {
          items: {
            create: (assignment: CaseAttorneyAssignment) => {
              assignment.id = `assignment-id-${Math.round(Math.random() * 1000)}`;
              this.caseAssignments.push(assignment);
              return {
                item: {
                  ...assignment,
                },
              };
            },
            query: (query: QueryOptions) => {
              this.itemQueryParams = query.parameters;
              return {
                fetchAll: () => {
                  const result: CaseAttorneyAssignment[] = [];
                  query.parameters.forEach((params) => {
                    this.caseAssignments.find((caseItem) => {
                      if (caseItem.caseId === params.value) {
                        result.push(caseItem);
                      }
                    });
                  });
                  return { resources: result };
                },
              };
            },
          },
        };
      },
    };
  }
}
