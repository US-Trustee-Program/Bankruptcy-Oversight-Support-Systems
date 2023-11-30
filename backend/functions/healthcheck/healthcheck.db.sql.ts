import { ApplicationContext } from '../lib/adapters/types/basic';
import { getSqlConnection } from '../lib/factory';
import log from '../lib/adapters/services/logger.service';

const MODULE_NAME = 'HEALTHCHECK-SQL-DB';

export default class HealthcheckSqlDb {
  private readonly applicationContext: ApplicationContext;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
  }

  public async checkDxtrDbRead() {
    try {
      const client = getSqlConnection(this.applicationContext.config.dxtrDbConfig);
      const sqlConnection = await client.connect();
      const sqlRequest = sqlConnection.request();
      const results = await sqlRequest.query('SELECT TOP 1 * FROM [dbo].[AO_CSS]');
      sqlConnection.close();
      return results.recordset.length > 0;
    } catch (error) {
      log.error(this.applicationContext, MODULE_NAME, error.message, error);
    }
    return false;
  }
}
