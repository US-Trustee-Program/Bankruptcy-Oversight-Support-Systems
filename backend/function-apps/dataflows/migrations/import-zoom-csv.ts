import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../azure/application-context-creator';
import * as ImportZoomCsvUseCase from '../../../lib/use-cases/dataflows/import-zoom-csv';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.IMPORT_ZOOM_CSV;

export async function handleImportZoomCsv(
  _request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });

  const result = await ImportZoomCsvUseCase.importZoomCsv(context);

  if (result.error) {
    context.logger.error(MODULE_NAME, result.error.message, result.error);
    return { status: 500, body: JSON.stringify({ error: result.error.message }) };
  }

  context.logger.info(MODULE_NAME, 'Zoom CSV import complete', result.data);
  return { status: 200, body: JSON.stringify(result.data) };
}

function setup() {
  app.http('importZoomCsv', {
    route: 'migrate/import-zoom-csv',
    methods: ['POST'],
    handler: handleImportZoomCsv,
  });
}

const ImportZoomCsv = {
  MODULE_NAME,
  setup,
};

export default ImportZoomCsv;
