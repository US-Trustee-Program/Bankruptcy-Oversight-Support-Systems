import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';
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
  public database(id: string) {
    let newCaseId: string;
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      container: (caseId: string) => {
        newCaseId = caseId;
        return {
          items: {
            create: (assignment: CaseAttorneyAssignment) => {
              return {
                item: {
                  id: (() => {
                    const id = `case-id-${Math.round(Math.random() * 1000)}`;
                    const caseAttorneyAssignment = new CaseAttorneyAssignment(
                      newCaseId,
                      'Mrs. John',
                      CaseAssignmentRole.TrialAttorney,
                      'Random Case Title',
                    );
                    caseAttorneyAssignment.id = id;
                    this.caseAssignments.push(caseAttorneyAssignment);
                    return id;
                  })(),
                  ...assignment,
                },
              };
            },
            query: (query: QueryOptions) => {
              this.itemQueryParams = query.parameters;
              return {
                fetchAll: () => {
                  let result: CaseAttorneyAssignment[] = [];
                  query.parameters.forEach((params) => {
                    this.caseAssignments.find((caseItem) => {
                      if (caseItem.caseId === params.value) {
                        result.push(caseItem);
                      }
                    });
                  });
                  return result;
                },
              };
            },
          },
        };
      },
    };
  }
}
