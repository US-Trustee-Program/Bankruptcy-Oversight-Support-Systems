import { ApplicationContext } from '../../../lib/adapters/types/basic';
import factory from '../../../lib/factory';

const MODULE_NAME = 'HEALTHCHECK-SQL-DB';

export default class HealthcheckSqlDb {
  private readonly applicationContext: ApplicationContext;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
  }

  public async checkDxtrDbRead() {
    try {
      const client = factory.getSqlConnection(this.applicationContext.config.dxtrDbConfig);
      const sqlConnection = await client.connect();
      const sqlRequest = sqlConnection.request();
      const results = await sqlRequest.query('SELECT TOP 1 * FROM [dbo].[AO_CS]');
      sqlConnection.close();
      return results.recordset.length > 0;
    } catch (error) {
      this.applicationContext.logger.error(MODULE_NAME, error.message, error);
    }
    return false;
  }
}
