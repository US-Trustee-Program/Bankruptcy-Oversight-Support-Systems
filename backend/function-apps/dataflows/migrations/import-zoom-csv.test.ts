import { describe, test, expect, vi, afterEach } from 'vitest';
import { handleImportZoomCsv } from './import-zoom-csv';
import { InvocationContext } from '@azure/functions';
import * as ImportZoomCsvUseCase from '../../../lib/use-cases/dataflows/import-zoom-csv';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { createMockAzureFunctionRequest } from '../../azure/testing-helpers';

const context = new InvocationContext({
  logHandler: () => {},
  invocationId: 'test-invocation-id',
});

describe('import-zoom-csv trigger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return 200 with ZoomImportResult on success', async () => {
    const importResult = { total: 5, matched: 3, unmatched: 1, ambiguous: 1, errors: 0 };
    vi.spyOn(ImportZoomCsvUseCase, 'importZoomCsv').mockResolvedValue({ data: importResult });

    const response = await handleImportZoomCsv(createMockAzureFunctionRequest({}), context);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual(importResult);
  });

  test('should return 500 with error message on use case failure', async () => {
    const error = new CamsError('IMPORT-ZOOM-CSV', { message: 'Something went wrong' });
    vi.spyOn(ImportZoomCsvUseCase, 'importZoomCsv').mockResolvedValue({ error });

    const response = await handleImportZoomCsv(createMockAzureFunctionRequest({}), context);

    expect(response.status).toBe(500);
    expect(JSON.parse(response.body as string)).toEqual({ error: error.message });
  });
});
