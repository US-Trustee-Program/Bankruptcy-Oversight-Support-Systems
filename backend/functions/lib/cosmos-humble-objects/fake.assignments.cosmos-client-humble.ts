import { ForbiddenError } from '../common-errors/forbidden-error';
import { AggregateAuthenticationError } from '@azure/identity';
import { UnknownError } from '../common-errors/unknown-error';
import { GatewayHelper } from '../adapters/gateways/gateway-helper';
import { NotFoundError } from '../common-errors/not-found-error';
import {
  NOT_FOUND_ERROR_CASE_ID,
  THROW_PERMISSIONS_ERROR_CASE_ID,
  THROW_UNKNOWN_ERROR_CASE_ID,
} from '../testing/testing-constants';
import { CaseAssignment } from '../../../../common/src/cams/assignments';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';

const MODULE_NAME = 'COSMOS_DB_REPOSITORY_ASSIGNMENTS';
interface QueryParams {
  name: string;
  value: string;
}

interface QueryOptions {
  query: string;
  parameters: QueryParams[];
}

export default class FakeAssignmentsCosmosClientHumble {
  private caseAssignments: CaseAssignment[] = [];
  private itemQueryParams: QueryParams[] = [];

  public database(_databaseId: string) {
    return {
      container: (_containerName: string) => {
        return {
          items: {
            create: (assignment: CaseAssignment) => {
              if (assignment.caseId === THROW_PERMISSIONS_ERROR_CASE_ID) {
                throw new ForbiddenError(MODULE_NAME, { message: 'forbidden' });
              }
              if (assignment.caseId === THROW_UNKNOWN_ERROR_CASE_ID) {
                throw new UnknownError(MODULE_NAME, { message: 'unknown' });
              }
              if (!assignment || !assignment.documentType) {
                assignment = {
                  documentType: 'ASSIGNMENT',
                  caseId: '012-23-12345',
                  userId: 'userId-Test Attorney',
                  name: 'Test Attorney',
                  role: 'TrialAttorney',
                  assignedOn: '2024-03-05',
                  updatedOn: '2024-03-05',
                  updatedBy: MockData.getCamsUserReference(),
                };
              }
              assignment.id = `assignment-id-${Math.round(Math.random() * 1000)}`;
              this.caseAssignments.push(assignment);
              return {
                resource: {
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
                  if (query.query.includes('"ASSIGNMENT"')) {
                    const result: CaseAssignment[] = [];
                    query.parameters.forEach((params) => {
                      this.caseAssignments.find((caseItem) => {
                        if (caseItem.caseId === params.value) {
                          result.push(caseItem);
                        }
                        if (caseItem.userId === params.value) {
                          result.push(caseItem);
                        }
                      });
                    });
                    return { resources: result };
                  } else if (query.query.includes('"AUDIT_ASSIGNMENT"')) {
                    const gatewayHelper = new GatewayHelper();
                    return { resources: gatewayHelper.getCaseHistoryMockExtract() };
                  }
                },
              };
            },
            readAll: () => {
              return {
                fetchAll: () => {
                  return { resources: this.caseAssignments };
                },
              };
            },
          },
          item: (_id: string, _partitionKey?: string) => {
            return {
              replace: (assignment: CaseAssignment) => {
                if (assignment.caseId === THROW_PERMISSIONS_ERROR_CASE_ID) {
                  throw new ForbiddenError(MODULE_NAME, { message: 'forbidden' });
                }
                if (assignment.caseId === THROW_UNKNOWN_ERROR_CASE_ID) {
                  throw new UnknownError(MODULE_NAME);
                }
                return {
                  resource: assignment,
                };
              },
              delete: () => {},
            };
          },
        };
      },
    };
  }
}
