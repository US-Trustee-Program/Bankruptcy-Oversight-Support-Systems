import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import { createAuditRecord } from '@common/cams/auditable';
import { getCamsUserReference } from '@common/cams/session';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'BANKRUPTCY-SOFTWARE-USE-CASE';

export class BankruptcySoftwareUseCase {
  private readonly repository;
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
    this.repository = factory.getBankruptcySoftwareRepository(context);
  }

  async getSoftwareList(): Promise<BankruptcySoftwareProfile[]> {
    try {
      return await this.repository.getSoftwareList();
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve bankruptcy software.');
    }
  }

  async createSoftware(input: { name: string }): Promise<BankruptcySoftwareProfile> {
    const userRef = getCamsUserReference(this.context.session.user);

    const softwareData = createAuditRecord<BankruptcySoftwareProfile>(
      {
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: input.name,
        status: 'active',
      },
      userRef,
    );

    try {
      const createdSoftware = await this.repository.createSoftware(softwareData);

      await this.repository.createSoftwareAuditRecord(
        createAuditRecord(
          {
            documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
            softwareId: createdSoftware.id,
            before: null,
            after: createdSoftware,
          },
          userRef,
        ),
      );

      return createdSoftware;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create bankruptcy software.');
    }
  }
}
