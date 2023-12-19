import { ForbiddenError } from '../common-errors/forbidden-error';
import { AggregateAuthenticationError } from '@azure/identity';
import { UnknownError } from '../common-errors/unknown-error';
import { CaseAssignment } from '../adapters/types/case.assignment';
import { GatewayHelper } from '../adapters/gateways/gateway-helper';
import { NotFoundError } from '../common-errors/not-found-error';

const MODULE_NAME = 'COSMOS_DB_REPOSITORY_ASSIGNMENTS';
interface QueryParams {
  name: string;
  value: string;
}

interface QueryOptions {
  query: string;
  parameters: QueryParams[];
}

export const NORMAL_CASE_ID = '111-11-11111';
export const NOT_FOUND_ERROR_CASE_ID = '000-00-00000';
export const THROW_PERMISSIONS_ERROR_CASE_ID = '888-88-88888';
export const THROW_UNKNOWN_ERROR_CASE_ID = '999-99-99999';

export default class FakeCosmosClientHumble {
  private caseAssignments: CaseAssignment[] = [];
  private itemQueryParams: QueryParams[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public database(databaseId: string) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      container: (containerName: string) => {
        return {
          items: {
            create: (assignment: CaseAssignment) => {
              if (assignment.caseId === THROW_PERMISSIONS_ERROR_CASE_ID) {
                throw new ForbiddenError(MODULE_NAME, { message: 'forbidden' });
              }
              if (assignment.caseId === THROW_UNKNOWN_ERROR_CASE_ID) {
                throw new UnknownError(MODULE_NAME, { message: 'unknown' });
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
                  if (this.itemQueryParams[0].value === THROW_PERMISSIONS_ERROR_CASE_ID) {
                    throw new AggregateAuthenticationError([], 'forbidden');
                  } else if (this.itemQueryParams[0].value === NOT_FOUND_ERROR_CASE_ID) {
                    throw new NotFoundError(MODULE_NAME, {
                      data: { ERROR_CASE_ID: NOT_FOUND_ERROR_CASE_ID },
                    });
                  }
                  if (this.itemQueryParams[1].value === 'ASSIGNMENT') {
                    const result: CaseAssignment[] = [];
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
                  } else if (this.itemQueryParams[1].value === 'ASSIGNMENT_HISTORY') {
                    const gatewayHelper = new GatewayHelper();
                    return { resources: gatewayHelper.getCaseHistoryMockExtract() };
                  }
                },
              };
            },
          },
          item: (id: string) => {
            return {
              replace: (assignment: CaseAssignment) => {
                if (assignment.caseId === THROW_PERMISSIONS_ERROR_CASE_ID) {
                  throw new ForbiddenError(MODULE_NAME, { message: 'forbidden' });
                }
                if (assignment.caseId === THROW_UNKNOWN_ERROR_CASE_ID) {
                  throw new UnknownError(MODULE_NAME);
                }
                console.log(id);
                return {
                  item: assignment,
                };
              },
            };
          },
        };
      },
    };
  }
}
