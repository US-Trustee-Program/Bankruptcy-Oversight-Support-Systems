import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';
import { AssignmentException } from '../use-cases/assignment.exception';
import { AggregateAuthenticationError } from '@azure/identity';

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
      container: (containerName: string) => {
        return {
          items: {
            create: (assignment: CaseAttorneyAssignment) => {
              if (assignment.caseId === 'throw-permissions-error') {
                throw new AssignmentException(403, 'forbidden');
              }
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
                  if (this.itemQueryParams[0].value === 'throw auth error') {
                    throw new AggregateAuthenticationError([], 'forbidden');
                  }
                  const result: CaseAttorneyAssignment[] = [];
                  query.parameters.forEach((params) => {
                    this.caseAssignments.find((caseItem) => {
                      if (caseItem.caseId === params.value) {
                        result.push(caseItem);
                      }
                      if (caseItem.name === params.value) {
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
