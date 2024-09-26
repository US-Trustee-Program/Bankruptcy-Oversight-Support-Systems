import { CamsRole } from '../../../../../common/src/cams/roles';
import MockUsers from '../../../../../common/src/cams/test-utilities/mock-user';
import { AttorneyUser, CamsUserReference } from '../../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import { getStorageGateway } from '../../factory';
import { OfficesRepository } from '../../use-cases/gateways.types';
import { createMockApplicationContext } from '../testing-utilities';

export class MockOfficesRepository implements OfficesRepository {
  async getOfficeAttorneys(
    context: ApplicationContext,
    officeCode: string,
  ): Promise<AttorneyUser[]> {
    // TODO: Remap the office code to use the user.offices when user.offices is changed to use UstpOfficeDetail.
    const storageGateway = getStorageGateway(context);
    const ustpOffices = storageGateway.getUstpOffices();
    if (!ustpOffices.has(officeCode)) {
      return Promise.resolve([]);
    }
    const ustpOffice = ustpOffices.get(officeCode);
    const users: AttorneyUser[] = MockUsers.filter(
      (mockUser) =>
        mockUser.user.roles.includes(CamsRole.TrialAttorney) &&
        !!mockUser.user.offices.find(
          (office) => !!ustpOffice.groups.find((o) => o.groupDesignator === office.groupDesignator),
        ),
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

// Test
createMockApplicationContext().then((context) => {
  const repo = new MockOfficesRepository();
  const printAttorneys = (attorneys: AttorneyUser[]) =>
    console.log(
      JSON.stringify(
        attorneys.map((a) => a.name),
        null,
        2,
      ),
    );
  repo.getOfficeAttorneys(context, 'USTP_CAMS_Region_2_Office_Manhattan').then(printAttorneys);
  repo.getOfficeAttorneys(context, 'USTP_CAMS_Region_2_Office_Buffalo').then(printAttorneys);
});
