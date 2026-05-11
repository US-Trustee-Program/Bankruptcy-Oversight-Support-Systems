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

describe('staff-assignment-handler', () => {
  let mockRequest: { input: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();
    const sql = await import('mssql');
    mockRequest = { input: vi.fn().mockReturnThis(), query: vi.fn().mockResolvedValue({}) };
    const mockPool = { request: vi.fn().mockReturnValue(mockRequest) };
    vi.mocked(sql.connect).mockResolvedValue(mockPool as unknown as import('mssql').ConnectionPool);
  });

  async function getHandler() {
    await import('./staff-assignment-handler');
    const { app } = await import('@azure/functions');
    return (
      app as unknown as {
        _handlers: Record<string, (item: unknown, ctx: InvocationContext) => Promise<void>>;
      }
    )._handlers['staff-assignment-handler'];
  }

  function makeContext(): InvocationContext {
    return new InvocationContext();
  }

  const validEvent = {
    caseId: '081-24-12345',
    userId: 'user-abc',
    name: 'John Smith',
    role: 'TrialAttorney',
    assignedOn: '2024-11-15T10:00:00Z',
    documentType: 'ASSIGNMENT',
    acmsProfessionalId: 'NY-00063',
  };

  test('upserts CMMAP_CAMS row for a valid active assignment', async () => {
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
    const { parseCaseId } = await import('./staff-assignment-handler');
    expect(parseCaseId('081-24-12345')).toEqual({ div: 81, year: 24, number: 12345 });
  });

  test('parses case ID with leading zeros', async () => {
    const { parseCaseId } = await import('./staff-assignment-handler');
    expect(parseCaseId('001-00-00001')).toEqual({ div: 1, year: 0, number: 1 });
  });

  test('throws on invalid format', async () => {
    const { parseCaseId } = await import('./staff-assignment-handler');
    expect(() => parseCaseId('81-24-12345')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('081-2-12345')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('081-24-1234')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('ABC-24-12345')).toThrow('Invalid CAMS case ID format');
  });
});

describe('toAcmsDateNumeric', () => {
  test('converts ISO timestamp to YYYYMMDD', async () => {
    const { toAcmsDateNumeric } = await import('./staff-assignment-handler');
    expect(toAcmsDateNumeric('2024-11-15T10:30:00Z')).toBe(20241115);
    expect(toAcmsDateNumeric('2024-01-05T00:00:00Z')).toBe(20240105);
  });

  test('handles date-only strings', async () => {
    const { toAcmsDateNumeric } = await import('./staff-assignment-handler');
    expect(toAcmsDateNumeric('2024-11-15')).toBe(20241115);
  });

  test('uses date portion from offset timestamps', async () => {
    const { toAcmsDateNumeric } = await import('./staff-assignment-handler');
    expect(toAcmsDateNumeric('2024-11-15T00:00:00-05:00')).toBe(20241115);
  });
});

describe('extractLastName', () => {
  test('extracts last word uppercased', async () => {
    const { extractLastName } = await import('./staff-assignment-handler');
    expect(extractLastName('John Smith')).toBe('SMITH');
    expect(extractLastName('Jane Marie Doe')).toBe('DOE');
  });

  test('handles hyphenated names', async () => {
    const { extractLastName } = await import('./staff-assignment-handler');
    expect(extractLastName('Maria Garcia-Rodriguez')).toBe('GARCIA-RODRIGUEZ');
  });

  test('trims whitespace', async () => {
    const { extractLastName } = await import('./staff-assignment-handler');
    expect(extractLastName('  John Smith  ')).toBe('SMITH');
  });
});

describe('transformToStagingRow', () => {
  const baseEvent = {
    caseId: '081-24-12345',
    userId: 'user-12345',
    name: 'John Q. Smith',
    role: 'TrialAttorney',
    assignedOn: '2024-11-15T10:00:00Z',
    documentType: 'ASSIGNMENT',
    acmsProfessionalId: 'NY-00063',
  };

  test('active assignment sets APPT_DISP to AP', async () => {
    const { transformToStagingRow } = await import('./staff-assignment-handler');
    const result = transformToStagingRow(baseEvent);
    expect(result.APPT_DISP).toBe('AP');
    expect(result.APPTEE_ACTIVE).toBe('Y');
    expect(result.DISP_DATE).toBeNull();
    expect(result.DISP_DATE_DT).toBeNull();
  });

  test('unassigned event sets APPT_DISP to WD', async () => {
    const { transformToStagingRow } = await import('./staff-assignment-handler');
    const result = transformToStagingRow({ ...baseEvent, unassignedOn: '2024-11-20T15:30:00Z' });
    expect(result.APPT_DISP).toBe('WD');
    expect(result.APPTEE_ACTIVE).toBe('N');
    expect(result.DISP_DATE).toBe(20241120);
    expect(result.DISP_DATE_DT).toEqual(new Date('2024-11-20T15:30:00Z'));
  });

  test('parses acmsProfessionalId into PROF_CODE and GROUP_DESIGNATOR', async () => {
    const { transformToStagingRow } = await import('./staff-assignment-handler');
    const result = transformToStagingRow({ ...baseEvent, acmsProfessionalId: 'NY-00063' });
    expect(result.GROUP_DESIGNATOR).toBe('NY');
    expect(result.PROF_CODE).toBe(63);
  });

  test('handles multi-character group designators', async () => {
    const { transformToStagingRow } = await import('./staff-assignment-handler');
    const result = transformToStagingRow({ ...baseEvent, acmsProfessionalId: 'UT-05321' });
    expect(result.GROUP_DESIGNATOR).toBe('UT');
    expect(result.PROF_CODE).toBe(5321);
  });

  test('throws when acmsProfessionalId is null', async () => {
    const { transformToStagingRow } = await import('./staff-assignment-handler');
    expect(() => transformToStagingRow({ ...baseEvent, acmsProfessionalId: null })).toThrow(
      'Cannot transform event: acmsProfessionalId is null for caseId 081-24-12345',
    );
  });

  test('maps case ID fields correctly', async () => {
    const { transformToStagingRow } = await import('./staff-assignment-handler');
    const result = transformToStagingRow(baseEvent);
    expect(result.CASE_DIV).toBe(81);
    expect(result.CASE_YEAR).toBe(24);
    expect(result.CASE_NUMBER).toBe(12345);
    expect(result.CAMS_CASE_ID).toBe('081-24-12345');
  });

  test('sets APPT_TYPE to S1', async () => {
    const { transformToStagingRow } = await import('./staff-assignment-handler');
    expect(transformToStagingRow(baseEvent).APPT_TYPE).toBe('S1');
  });

  test('sets CAMS metadata fields', async () => {
    const { transformToStagingRow } = await import('./staff-assignment-handler');
    const result = transformToStagingRow(baseEvent);
    expect(result.SOURCE).toBe('CAMS');
    expect(result.CAMS_USER_ID).toBe('user-12345');
    expect(result.CAMS_USER_NAME).toBe('John Q. Smith');
    expect(result.USER_ID).toBe('CAMS');
  });

  test('sets ALPHA_SEARCH from last name', async () => {
    const { transformToStagingRow } = await import('./staff-assignment-handler');
    expect(transformToStagingRow(baseEvent).ALPHA_SEARCH).toBe('SMITH');
  });

  test('sets APPT_DATE correctly', async () => {
    const { transformToStagingRow } = await import('./staff-assignment-handler');
    const result = transformToStagingRow(baseEvent);
    expect(result.APPT_DATE).toBe(20241115);
    expect(result.APPT_DATE_DT).toEqual(new Date('2024-11-15T10:00:00Z'));
  });

  test('sets nullable fields to null for Ch15', async () => {
    const { transformToStagingRow } = await import('./staff-assignment-handler');
    const result = transformToStagingRow(baseEvent);
    expect(result.COMMENTS).toBeNull();
    expect(result.HEARING_SEQUENCE).toBeNull();
    expect(result.REGION_CODE).toBeNull();
    expect(result.RGN_CREATE_DATE).toBeNull();
    expect(result.RGN_CREATE_DATE_DT).toBeNull();
  });
});
