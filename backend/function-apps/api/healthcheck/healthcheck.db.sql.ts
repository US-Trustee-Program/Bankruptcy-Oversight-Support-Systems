import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { AbstractMssqlClient } from '../../../lib/adapters/gateways/abstract-mssql-client';

const MODULE_NAME = 'HEALTHCHECK-SQL-DB';

export default class HealthcheckSqlDb extends AbstractMssqlClient {
  private readonly applicationContext: ApplicationContext;

  constructor(applicationContext: ApplicationContext) {
    super(applicationContext.config.dxtrDbConfig, MODULE_NAME);
    this.applicationContext = applicationContext;
  }

  public async checkDxtrDbRead() {
    try {
      const result = await this.executeQuery(
        this.applicationContext,
        'SELECT TOP 1 * FROM [dbo].[AO_CS]',
      );
      return (result.results as { recordset: unknown[] }).recordset.length > 0;
    } catch (error) {
      this.applicationContext.logger.error(MODULE_NAME, error.message, error);
    }
    return false;
  }
}
