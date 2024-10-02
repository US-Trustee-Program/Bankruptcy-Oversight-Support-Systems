import { CamsRole } from '../../../../../common/src/cams/roles';
import MockUsers from '../../../../../common/src/cams/test-utilities/mock-user';
import { AttorneyUser, CamsUserReference } from '../../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import { getStorageGateway } from '../../factory';
import { OfficesRepository } from '../../use-cases/gateways.types';

export class MockOfficesRepository implements OfficesRepository {
  async getOfficeAttorneys(
    context: ApplicationContext,
    officeCode: string,
  ): Promise<AttorneyUser[]> {
    // TODO: Remap the office code to use the user.offices when user.offices is changed to use UstpOfficeDetail.
    const storageGateway = getStorageGateway(context);
    const ustpOffices = storageGateway.getUstpOffices();
    if (!ustpOffices.find((office) => office.officeCode === officeCode)) {
      return Promise.resolve([]);
    }
    const users: AttorneyUser[] = MockUsers.filter(
      (mockUser) =>
        mockUser.user.roles.includes(CamsRole.TrialAttorney) &&
        !!mockUser.user.offices.find((o) => o.officeCode === officeCode),
    ).map<AttorneyUser>((mockUser) => mockUser.user);
    return Promise.resolve(users);
  }

  putOfficeStaff(
    _context: ApplicationContext,
    _officeCode: string,
    _user: CamsUserReference,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
