import { describe, test, beforeEach, expect, vi } from 'vitest';
import { InvocationContext } from '@azure/functions';

vi.mock('mssql', async () => {
  const mockRequest = {
    input: vi.fn().mockReturnThis(),
    query: vi.fn().mockResolvedValue({}),
  };
  const mockPool = { request: vi.fn().mockReturnValue(mockRequest) };
  return {
    default: {},
    connect: vi.fn().mockResolvedValue(mockPool),
    Char: vi.fn(),
    Numeric: vi.fn(),
    DateTime2: vi.fn(),
    VarChar: vi.fn(),
  };
});

vi.mock('@azure/functions', async () => {
  const handlers: Record<string, (item: unknown, ctx: InvocationContext) => Promise<void>> = {};
  return {
    app: {
      storageQueue: vi.fn((name, options) => {
        handlers[name] = options.handler;
      }),
      _handlers: handlers,
    },
    output: { storageQueue: vi.fn().mockReturnValue({ type: 'storageQueue' }) },
    InvocationContext: vi.fn().mockImplementation(() => ({
      log: vi.fn(),
      extraOutputs: { set: vi.fn(), get: vi.fn() },
    })),
  };
});

vi.mock('@common/queues', () => ({
  buildQueueName: vi.fn((name: string, suffix?: string) =>
    suffix ? `${name}-${suffix}`.toLowerCase() : name.toLowerCase(),
  ),
}));

describe('trustee-appointment-handler', () => {
  let mockRequest: { input: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();
    const sql = await import('mssql');
    mockRequest = { input: vi.fn().mockReturnThis(), query: vi.fn().mockResolvedValue({}) };
    const mockPool = { request: vi.fn().mockReturnValue(mockRequest) };
    vi.mocked(sql.connect).mockResolvedValue(mockPool as unknown as import('mssql').ConnectionPool);
  });

  async function getHandler() {
    await import('./trustee-appointment-handler');
    const { app } = await import('@azure/functions');
    return (
      app as unknown as {
        _handlers: Record<string, (item: unknown, ctx: InvocationContext) => Promise<void>>;
      }
    )._handlers['trustee-appointment-handler'];
  }

  function makeContext(): InvocationContext {
    return new InvocationContext();
  }

  const validEvent = {
    caseId: '081-24-12345',
    trusteeId: 'trustee-abc',
    acmsProfessionalId: 'NY-00063',
    apptType: 'TR',
    assignedOn: '2024-11-15T10:00:00Z',
    chapter: '7',
  };

  test('upserts CMMAP_CAMS row for a valid active appointment', async () => {
    const handler = await getHandler();
    const ctx = makeContext();

    await handler(validEvent, ctx);

    expect(mockRequest.query).toHaveBeenCalledTimes(1);
    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('parses event when delivered as a JSON string', async () => {
    const handler = await getHandler();
    const ctx = makeContext();

    await handler(JSON.stringify(validEvent), ctx);

    expect(mockRequest.query).toHaveBeenCalledTimes(1);
    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('routes to DLQ when required fields are missing', async () => {
    const handler = await getHandler();
    const ctx = makeContext();

    await handler({ caseId: '081-24-12345' }, ctx);

    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(ctx.extraOutputs.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'QUEUE_ERROR' }),
    );
  });

  test('routes to DLQ when SQL upsert throws', async () => {
    const handler = await getHandler();
    const ctx = makeContext();
    mockRequest.query.mockRejectedValueOnce(new Error('SQL timeout'));

    await handler(validEvent, ctx);

    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(ctx.extraOutputs.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'QUEUE_ERROR' }),
    );
  });
});

describe('parseCaseId', () => {
  test('parses valid CAMS case ID', async () => {
    const { parseCaseId } = await import('./trustee-appointment-handler');
    expect(parseCaseId('081-24-12345')).toEqual({ div: 81, year: 24, number: 12345 });
  });

  test('parses case ID with leading zeros', async () => {
    const { parseCaseId } = await import('./trustee-appointment-handler');
    expect(parseCaseId('001-00-00001')).toEqual({ div: 1, year: 0, number: 1 });
  });

  test('throws on invalid format — wrong segment lengths', async () => {
    const { parseCaseId } = await import('./trustee-appointment-handler');
    expect(() => parseCaseId('81-24-12345')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('081-2-12345')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('081-24-1234')).toThrow('Invalid CAMS case ID format');
  });

  test('throws on non-numeric segments', async () => {
    const { parseCaseId } = await import('./trustee-appointment-handler');
    expect(() => parseCaseId('ABC-24-12345')).toThrow('Invalid CAMS case ID format');
  });
});

describe('toAcmsDateNumeric', () => {
  test('converts ISO timestamp to YYYYMMDD', async () => {
    const { toAcmsDateNumeric } = await import('./trustee-appointment-handler');
    expect(toAcmsDateNumeric('2024-11-15T10:30:00Z')).toBe(20241115);
    expect(toAcmsDateNumeric('2024-01-05T00:00:00Z')).toBe(20240105);
  });

  test('handles date-only strings', async () => {
    const { toAcmsDateNumeric } = await import('./trustee-appointment-handler');
    expect(toAcmsDateNumeric('2024-11-15')).toBe(20241115);
  });

  test('uses date portion from offset timestamps', async () => {
    const { toAcmsDateNumeric } = await import('./trustee-appointment-handler');
    expect(toAcmsDateNumeric('2024-11-15T00:00:00-05:00')).toBe(20241115);
  });
});

describe('transformTrusteeToStagingRow', () => {
  const baseEvent = {
    caseId: '081-24-12345',
    trusteeId: 'trustee-abc123',
    acmsProfessionalId: 'NY-00063',
    apptType: 'TR' as const,
    assignedOn: '2024-11-15T10:00:00Z',
    chapter: '7',
  };

  test('active appointment sets APPT_DISP to GR', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    const result = transformTrusteeToStagingRow(baseEvent);
    expect(result.APPT_DISP).toBe('GR');
    expect(result.APPTEE_ACTIVE).toBe('Y');
    expect(result.DISP_DATE).toBeNull();
    expect(result.DISP_DATE_DT).toBeNull();
  });

  test('closed appointment sets APPT_DISP to WD', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    const result = transformTrusteeToStagingRow({
      ...baseEvent,
      unassignedOn: '2024-11-20T15:30:00Z',
    });
    expect(result.APPT_DISP).toBe('WD');
    expect(result.APPTEE_ACTIVE).toBe('N');
    expect(result.DISP_DATE).toBe(20241120);
    expect(result.DISP_DATE_DT).toEqual(new Date('2024-11-20T15:30:00Z'));
  });

  test('APPT_DATE uses appointedDate when present', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    const result = transformTrusteeToStagingRow({ ...baseEvent, appointedDate: '2024-09-01' });
    expect(result.APPT_DATE).toBe(20240901);
    expect(result.APPT_DATE_DT).toEqual(new Date('2024-09-01'));
  });

  test('APPT_DATE falls back to assignedOn when appointedDate absent', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    const result = transformTrusteeToStagingRow(baseEvent);
    expect(result.APPT_DATE).toBe(20241115);
    expect(result.APPT_DATE_DT).toEqual(new Date('2024-11-15T10:00:00Z'));
  });

  test('parses acmsProfessionalId into PROF_CODE and GROUP_DESIGNATOR', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    const result = transformTrusteeToStagingRow({ ...baseEvent, acmsProfessionalId: 'NY-00063' });
    expect(result.GROUP_DESIGNATOR).toBe('NY');
    expect(result.PROF_CODE).toBe(63);
  });

  test('handles multi-character group designators', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    const result = transformTrusteeToStagingRow({ ...baseEvent, acmsProfessionalId: 'UT-05321' });
    expect(result.GROUP_DESIGNATOR).toBe('UT');
    expect(result.PROF_CODE).toBe(5321);
  });

  test('maps case ID fields correctly', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    const result = transformTrusteeToStagingRow(baseEvent);
    expect(result.CASE_DIV).toBe(81);
    expect(result.CASE_YEAR).toBe(24);
    expect(result.CASE_NUMBER).toBe(12345);
    expect(result.CAMS_CASE_ID).toBe('081-24-12345');
  });

  test('APPT_TYPE is always TR', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    expect(transformTrusteeToStagingRow(baseEvent).APPT_TYPE).toBe('TR');
  });

  test('ALPHA_SEARCH is null', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    expect(transformTrusteeToStagingRow(baseEvent).ALPHA_SEARCH).toBeNull();
  });

  test('CAMS_USER_ID and CAMS_USER_NAME are CAMS', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    const result = transformTrusteeToStagingRow(baseEvent);
    expect(result.CAMS_USER_ID).toBe('CAMS');
    expect(result.CAMS_USER_NAME).toBe('CAMS');
    expect(result.USER_ID).toBe('CAMS');
  });

  test('SOURCE is CAMS', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    expect(transformTrusteeToStagingRow(baseEvent).SOURCE).toBe('CAMS');
  });

  test('sets nullable fields to null', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    const result = transformTrusteeToStagingRow(baseEvent);
    expect(result.COMMENTS).toBeNull();
    expect(result.HEARING_SEQUENCE).toBeNull();
    expect(result.REGION_CODE).toBeNull();
    expect(result.RGN_CREATE_DATE).toBeNull();
    expect(result.RGN_CREATE_DATE_DT).toBeNull();
  });

  test('RECORD_SEQ_NBR is always 1', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    expect(transformTrusteeToStagingRow(baseEvent).RECORD_SEQ_NBR).toBe(1);
  });

  test('DELETE_CODE is a single space', async () => {
    const { transformTrusteeToStagingRow } = await import('./trustee-appointment-handler');
    expect(transformTrusteeToStagingRow(baseEvent).DELETE_CODE).toBe(' ');
  });
});
