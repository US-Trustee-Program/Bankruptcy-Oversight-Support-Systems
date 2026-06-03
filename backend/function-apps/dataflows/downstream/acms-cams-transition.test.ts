import { describe, test, beforeEach, expect, vi } from 'vitest';
import { app, InvocationContext, StorageQueueOutput } from '@azure/functions';
import {
  staffAssignmentHandler,
  trusteeAppointmentHandler,
  parseCaseId,
  toAcmsDateNumeric,
  extractLastName,
  transformStaffAssignmentToRow,
  transformTrusteeAppointmentToRow,
  serializeError,
  ValidationError,
} from './acms-cams-transition';
import StaffAssignmentDownstream from './staff-assignment-downstream';
import TrusteeAppointmentDownstream from './trustee-appointment-downstream';

const mockRequest = {
  input: vi.fn().mockReturnThis(),
  query: vi.fn().mockResolvedValue({}),
};
const mockPool = {
  connected: true,
  connect: vi.fn().mockResolvedValue(undefined),
  request: vi.fn().mockReturnValue(mockRequest),
  close: vi.fn(),
};

vi.mock('mssql', async () => {
  return {
    default: {},
    ConnectionPool: vi.fn(function () {
      return mockPool;
    }),
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
      storageQueue: vi.fn(function (name, options) {
        handlers[name] = options.handler;
      }),
      _handlers: handlers,
    },
    output: { storageQueue: vi.fn().mockReturnValue({ type: 'storageQueue' }) },
    InvocationContext: vi.fn().mockImplementation(function () {
      return {
        log: vi.fn(),
        extraOutputs: { set: vi.fn(), get: vi.fn() },
      };
    }),
  };
});

const mockDlq = { type: 'storageQueue' } as unknown as StorageQueueOutput;

// ─── Staff assignment handler ─────────────────────────────────────────────────

describe('staffAssignmentHandler', () => {
  beforeEach(() => {
    mockRequest.input.mockReset().mockReturnThis();
    mockRequest.query.mockReset().mockResolvedValue({});
    mockPool.connect.mockReset().mockResolvedValue(undefined);
  });

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
    const ctx = makeContext();

    await staffAssignmentHandler(validEvent, ctx, mockDlq);

    expect(mockRequest.query).toHaveBeenCalledTimes(1);
    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('parses event when delivered as a JSON string', async () => {
    const ctx = makeContext();

    await staffAssignmentHandler(JSON.stringify(validEvent), ctx, mockDlq);

    expect(mockRequest.query).toHaveBeenCalledTimes(1);
    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('routes to DLQ when required fields are missing', async () => {
    const ctx = makeContext();

    await staffAssignmentHandler({ caseId: '081-24-12345' }, ctx, mockDlq);

    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(ctx.extraOutputs.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'QUEUE_ERROR' }),
    );
  });

  test('routes to DLQ when assignedOn is missing', async () => {
    const ctx = makeContext();
    const { assignedOn: _, ...eventWithoutAssignedOn } = validEvent;

    await staffAssignmentHandler(eventWithoutAssignedOn, ctx, mockDlq);

    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(ctx.extraOutputs.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'QUEUE_ERROR' }),
    );
  });

  test('re-throws when SQL upsert throws so Azure retries the message', async () => {
    const ctx = makeContext();
    mockRequest.query.mockRejectedValueOnce(new Error('SQL timeout'));

    await expect(staffAssignmentHandler(validEvent, ctx, mockDlq)).rejects.toThrow('SQL timeout');
    expect(ctx.extraOutputs.set).not.toHaveBeenCalled();
  });

  test('DLQ payload includes originalEvent when validation fails', async () => {
    const ctx = makeContext();
    const badEvent = { caseId: '081-24-12345' };

    await staffAssignmentHandler(badEvent, ctx, mockDlq);

    expect(ctx.extraOutputs.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'QUEUE_ERROR', originalEvent: badEvent }),
    );
  });

  test('DLQ error payload is a serialized plain object, not a raw Error', async () => {
    const ctx = makeContext();

    await staffAssignmentHandler({ caseId: '081-24-12345' }, ctx, mockDlq);

    const dlqPayload = (ctx.extraOutputs.set as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(dlqPayload.error).toEqual(
      expect.objectContaining({ name: expect.any(String), message: expect.any(String) }),
    );
    expect(dlqPayload.error).not.toBeInstanceOf(Error);
  });
});

// ─── Trustee appointment handler ──────────────────────────────────────────────

describe('trusteeAppointmentHandler', () => {
  beforeEach(() => {
    mockRequest.input.mockReset().mockReturnThis();
    mockRequest.query.mockReset().mockResolvedValue({});
    mockPool.connect.mockReset().mockResolvedValue(undefined);
  });

  function makeContext(): InvocationContext {
    return new InvocationContext();
  }

  const validEvent = {
    caseId: '081-24-12345',
    trusteeId: 'trustee-abc',
    acmsProfessionalId: 'NY-00063',
    assignedOn: '2024-11-15T10:00:00Z',
    chapter: '7',
  };

  test('upserts CMMAP_CAMS row for a valid active appointment', async () => {
    const ctx = makeContext();

    await trusteeAppointmentHandler(validEvent, ctx, mockDlq);

    expect(mockRequest.query).toHaveBeenCalledTimes(1);
    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('parses event when delivered as a JSON string', async () => {
    const ctx = makeContext();

    await trusteeAppointmentHandler(JSON.stringify(validEvent), ctx, mockDlq);

    expect(mockRequest.query).toHaveBeenCalledTimes(1);
    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('routes to DLQ when required fields are missing', async () => {
    const ctx = makeContext();

    await trusteeAppointmentHandler({ caseId: '081-24-12345' }, ctx, mockDlq);

    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(ctx.extraOutputs.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'QUEUE_ERROR' }),
    );
  });

  test('routes to DLQ when assignedOn is missing', async () => {
    const ctx = makeContext();
    const { assignedOn: _, ...eventWithoutAssignedOn } = validEvent;

    await trusteeAppointmentHandler(eventWithoutAssignedOn, ctx, mockDlq);

    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(ctx.extraOutputs.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'QUEUE_ERROR' }),
    );
  });

  test('re-throws when SQL upsert throws so Azure retries the message', async () => {
    const ctx = makeContext();
    mockRequest.query.mockRejectedValueOnce(new Error('SQL timeout'));

    await expect(trusteeAppointmentHandler(validEvent, ctx, mockDlq)).rejects.toThrow(
      'SQL timeout',
    );
    expect(ctx.extraOutputs.set).not.toHaveBeenCalled();
  });

  test('DLQ payload includes originalEvent when validation fails', async () => {
    const ctx = makeContext();
    const badEvent = { caseId: '081-24-12345' };

    await trusteeAppointmentHandler(badEvent, ctx, mockDlq);

    expect(ctx.extraOutputs.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'QUEUE_ERROR', originalEvent: badEvent }),
    );
  });

  test('DLQ error payload is a serialized plain object, not a raw Error', async () => {
    const ctx = makeContext();

    await trusteeAppointmentHandler({ caseId: '081-24-12345' }, ctx, mockDlq);

    const dlqPayload = (ctx.extraOutputs.set as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(dlqPayload.error).toEqual(
      expect.objectContaining({ name: expect.any(String), message: expect.any(String) }),
    );
    expect(dlqPayload.error).not.toBeInstanceOf(Error);
  });
});

// ─── Azure Functions registration ─────────────────────────────────────────────

describe('StaffAssignmentDownstream registration', () => {
  test('registers handler on the correct storage queue', () => {
    StaffAssignmentDownstream.setup();

    expect(app.storageQueue).toHaveBeenCalledWith(
      'STAFF-ASSIGNMENT-DOWNSTREAM-handler',
      expect.objectContaining({ handler: expect.any(Function) }),
    );
  });
});

describe('TrusteeAppointmentDownstream registration', () => {
  test('registers handler on the correct storage queue', () => {
    TrusteeAppointmentDownstream.setup();

    expect(app.storageQueue).toHaveBeenCalledWith(
      'TRUSTEE-APPOINTMENT-DOWNSTREAM-handler',
      expect.objectContaining({ handler: expect.any(Function) }),
    );
  });
});

// ─── upsertCmmapCamsRow SQL ───────────────────────────────────────────────────

describe('upsertCmmapCamsRow SQL', () => {
  beforeEach(() => {
    mockRequest.input.mockReset().mockReturnThis();
    mockRequest.query.mockReset().mockResolvedValue({});
    mockPool.connect.mockReset().mockResolvedValue(undefined);
  });

  function makeContext(): InvocationContext {
    return new InvocationContext();
  }

  test('staff-assignment SQL contains last-writer-wins guard on WHEN MATCHED', async () => {
    const ctx = makeContext();
    const event = {
      caseId: '081-24-12345',
      userId: 'user-abc',
      name: 'John Smith',
      role: 'TrialAttorney',
      assignedOn: '2024-11-15T10:00:00Z',
      documentType: 'ASSIGNMENT',
      acmsProfessionalId: 'NY-00063',
    };

    await staffAssignmentHandler(event, ctx, mockDlq);

    const callArg = mockRequest.query.mock.calls[0][0] as string;
    expect(callArg).toContain('WHEN MATCHED AND @LAST_UPDATED > target.LAST_UPDATED THEN');
    const lastUpdatedCall = (mockRequest.input as ReturnType<typeof vi.fn>).mock.calls.find(
      ([name]: [string]) => name === 'LAST_UPDATED',
    );
    expect(lastUpdatedCall).toBeDefined();
    expect(lastUpdatedCall![2]).toBeInstanceOf(Date);
  });

  test('trustee-appointment SQL contains last-writer-wins guard on WHEN MATCHED', async () => {
    const ctx = makeContext();
    const event = {
      caseId: '081-24-12345',
      trusteeId: 'trustee-abc',
      acmsProfessionalId: 'NY-00063',
      assignedOn: '2024-11-15T10:00:00Z',
      chapter: '7',
    };

    await trusteeAppointmentHandler(event, ctx, mockDlq);

    const callArg = mockRequest.query.mock.calls[0][0] as string;
    expect(callArg).toContain('WHEN MATCHED AND @LAST_UPDATED > target.LAST_UPDATED THEN');
    const lastUpdatedCall = (mockRequest.input as ReturnType<typeof vi.fn>).mock.calls.find(
      ([name]: [string]) => name === 'LAST_UPDATED',
    );
    expect(lastUpdatedCall).toBeDefined();
    expect(lastUpdatedCall![2]).toBeInstanceOf(Date);
  });
});

// ─── Shared helpers ───────────────────────────────────────────────────────────

describe('parseCaseId', () => {
  test('parses valid CAMS case ID', () => {
    expect(parseCaseId('081-24-12345')).toEqual({ div: 81, year: 24, number: 12345 });
  });

  test('parses case ID with leading zeros', () => {
    expect(parseCaseId('001-00-00001')).toEqual({ div: 1, year: 0, number: 1 });
  });

  test('throws on invalid format — wrong segment lengths', () => {
    expect(() => parseCaseId('81-24-12345')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('081-2-12345')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('081-24-1234')).toThrow('Invalid CAMS case ID format');
  });

  test('throws on non-numeric segments', () => {
    expect(() => parseCaseId('ABC-24-12345')).toThrow('Invalid CAMS case ID format');
  });
});

describe('toAcmsDateNumeric', () => {
  test('converts ISO timestamp to YYYYMMDD', () => {
    expect(toAcmsDateNumeric('2024-11-15T10:30:00Z')).toBe(20241115);
    expect(toAcmsDateNumeric('2024-01-05T00:00:00Z')).toBe(20240105);
  });

  test('handles date-only strings', () => {
    expect(toAcmsDateNumeric('2024-11-15')).toBe(20241115);
  });

  test('uses date portion from offset timestamps', () => {
    expect(toAcmsDateNumeric('2024-11-15T00:00:00-05:00')).toBe(20241115);
  });
});

describe('extractLastName', () => {
  test('extracts last word uppercased', () => {
    expect(extractLastName('John Smith')).toBe('SMITH');
    expect(extractLastName('Jane Marie Doe')).toBe('DOE');
  });

  test('handles hyphenated names', () => {
    expect(extractLastName('Maria Garcia-Rodriguez')).toBe('GARCIA-RODRIGUEZ');
  });

  test('trims whitespace', () => {
    expect(extractLastName('  John Smith  ')).toBe('SMITH');
  });
});

// ─── transformStaffAssignmentToRow ────────────────────────────────────────────

describe('transformStaffAssignmentToRow', () => {
  const baseEvent = {
    caseId: '081-24-12345',
    userId: 'user-12345',
    name: 'John Q. Smith',
    role: 'TrialAttorney',
    assignedOn: '2024-11-15T10:00:00Z',
    documentType: 'ASSIGNMENT' as const,
    acmsProfessionalId: 'NY-00063',
    updatedOn: '2024-11-15T10:00:00Z',
    updatedBy: { id: 'user-12345', name: 'John Q. Smith' },
  };

  test('active assignment sets APPT_DISP to AP', () => {
    const result = transformStaffAssignmentToRow(baseEvent);
    expect(result.APPT_DISP).toBe('AP');
    expect(result.APPTEE_ACTIVE).toBe('Y');
    expect(result.DISP_DATE).toBeNull();
    expect(result.DISP_DATE_DT).toBeNull();
  });

  test('unassigned event sets APPT_DISP to WD', () => {
    const result = transformStaffAssignmentToRow({
      ...baseEvent,
      unassignedOn: '2024-11-20T15:30:00Z',
    });
    expect(result.APPT_DISP).toBe('WD');
    expect(result.APPTEE_ACTIVE).toBe('N');
    expect(result.DISP_DATE).toBe(20241120);
    expect(result.DISP_DATE_DT).toEqual(new Date('2024-11-20T15:30:00Z'));
  });

  test('parses acmsProfessionalId into PROF_CODE and GROUP_DESIGNATOR', () => {
    const result = transformStaffAssignmentToRow({ ...baseEvent, acmsProfessionalId: 'NY-00063' });
    expect(result.GROUP_DESIGNATOR).toBe('NY');
    expect(result.PROF_CODE).toBe(63);
  });

  test('handles multi-character group designators', () => {
    const result = transformStaffAssignmentToRow({ ...baseEvent, acmsProfessionalId: 'UT-05321' });
    expect(result.GROUP_DESIGNATOR).toBe('UT');
    expect(result.PROF_CODE).toBe(5321);
  });

  test('throws when acmsProfessionalId is null — handler validation prevents this at runtime', () => {
    expect(() =>
      transformStaffAssignmentToRow({ ...baseEvent, acmsProfessionalId: null }),
    ).toThrow();
  });

  test('maps case ID fields correctly', () => {
    const result = transformStaffAssignmentToRow(baseEvent);
    expect(result.CASE_DIV).toBe(81);
    expect(result.CASE_YEAR).toBe(24);
    expect(result.CASE_NUMBER).toBe(12345);
    expect(result.CAMS_CASE_ID).toBe('081-24-12345');
  });

  test('sets APPT_TYPE to S1', () => {
    expect(transformStaffAssignmentToRow(baseEvent).APPT_TYPE).toBe('S1');
  });

  test('sets CAMS metadata fields', () => {
    const result = transformStaffAssignmentToRow(baseEvent);
    expect(result.SOURCE).toBe('CAMS');
    expect(result.CAMS_USER_ID).toBe('user-12345');
    expect(result.CAMS_USER_NAME).toBe('John Q. Smith');
    expect(result.USER_ID).toBe('CAMS');
  });

  test('sets ALPHA_SEARCH from last name', () => {
    expect(transformStaffAssignmentToRow(baseEvent).ALPHA_SEARCH).toBe('SMITH');
  });

  test('sets APPT_DATE correctly', () => {
    const result = transformStaffAssignmentToRow(baseEvent);
    expect(result.APPT_DATE).toBe(20241115);
    expect(result.APPT_DATE_DT).toEqual(new Date('2024-11-15T10:00:00Z'));
  });

  test('sets nullable fields to null', () => {
    const result = transformStaffAssignmentToRow(baseEvent);
    expect(result.COMMENTS).toBeNull();
    expect(result.HEARING_SEQUENCE).toBeNull();
    expect(result.REGION_CODE).toBeNull();
    expect(result.RGN_CREATE_DATE).toBeNull();
    expect(result.RGN_CREATE_DATE_DT).toBeNull();
  });

  test('active event sets LAST_UPDATED to new Date(assignedOn)', () => {
    const result = transformStaffAssignmentToRow(baseEvent);
    expect(result.LAST_UPDATED).toEqual(new Date('2024-11-15T10:00:00Z'));
  });

  test('unassigned event sets LAST_UPDATED to new Date(unassignedOn)', () => {
    const result = transformStaffAssignmentToRow({
      ...baseEvent,
      unassignedOn: '2024-11-20T15:30:00Z',
    });
    expect(result.LAST_UPDATED).toEqual(new Date('2024-11-20T15:30:00Z'));
  });
});

// ─── transformTrusteeAppointmentToRow ─────────────────────────────────────────

describe('transformTrusteeAppointmentToRow', () => {
  const baseEvent = {
    caseId: '081-24-12345',
    trusteeId: 'trustee-abc123',
    acmsProfessionalId: 'NY-00063',
    assignedOn: '2024-11-15T10:00:00Z',
    chapter: '7',
  };

  test('active appointment sets APPT_DISP to GR', () => {
    const result = transformTrusteeAppointmentToRow(baseEvent);
    expect(result.APPT_DISP).toBe('GR');
    expect(result.APPTEE_ACTIVE).toBe('Y');
    expect(result.DISP_DATE).toBeNull();
    expect(result.DISP_DATE_DT).toBeNull();
  });

  test('closed appointment sets APPT_DISP to WD', () => {
    const result = transformTrusteeAppointmentToRow({
      ...baseEvent,
      unassignedOn: '2024-11-20T15:30:00Z',
    });
    expect(result.APPT_DISP).toBe('WD');
    expect(result.APPTEE_ACTIVE).toBe('N');
    expect(result.DISP_DATE).toBe(20241120);
    expect(result.DISP_DATE_DT).toEqual(new Date('2024-11-20T15:30:00Z'));
  });

  test('APPT_DATE uses appointedDate when present', () => {
    const result = transformTrusteeAppointmentToRow({ ...baseEvent, appointedDate: '2024-09-01' });
    expect(result.APPT_DATE).toBe(20240901);
    expect(result.APPT_DATE_DT).toEqual(new Date('2024-09-01'));
  });

  test('APPT_DATE falls back to assignedOn when appointedDate absent', () => {
    const result = transformTrusteeAppointmentToRow(baseEvent);
    expect(result.APPT_DATE).toBe(20241115);
    expect(result.APPT_DATE_DT).toEqual(new Date('2024-11-15T10:00:00Z'));
  });

  test('parses acmsProfessionalId into PROF_CODE and GROUP_DESIGNATOR', () => {
    const result = transformTrusteeAppointmentToRow({
      ...baseEvent,
      acmsProfessionalId: 'NY-00063',
    });
    expect(result.GROUP_DESIGNATOR).toBe('NY');
    expect(result.PROF_CODE).toBe(63);
  });

  test('handles multi-character group designators', () => {
    const result = transformTrusteeAppointmentToRow({
      ...baseEvent,
      acmsProfessionalId: 'UT-05321',
    });
    expect(result.GROUP_DESIGNATOR).toBe('UT');
    expect(result.PROF_CODE).toBe(5321);
  });

  test('maps case ID fields correctly', () => {
    const result = transformTrusteeAppointmentToRow(baseEvent);
    expect(result.CASE_DIV).toBe(81);
    expect(result.CASE_YEAR).toBe(24);
    expect(result.CASE_NUMBER).toBe(12345);
    expect(result.CAMS_CASE_ID).toBe('081-24-12345');
  });

  test('APPT_TYPE is always TR', () => {
    expect(transformTrusteeAppointmentToRow(baseEvent).APPT_TYPE).toBe('TR');
  });

  test('ALPHA_SEARCH is null', () => {
    expect(transformTrusteeAppointmentToRow(baseEvent).ALPHA_SEARCH).toBeNull();
  });

  test('CAMS_USER_ID and CAMS_USER_NAME are CAMS', () => {
    const result = transformTrusteeAppointmentToRow(baseEvent);
    expect(result.CAMS_USER_ID).toBe('CAMS');
    expect(result.CAMS_USER_NAME).toBe('CAMS');
    expect(result.USER_ID).toBe('CAMS');
  });

  test('SOURCE is CAMS', () => {
    expect(transformTrusteeAppointmentToRow(baseEvent).SOURCE).toBe('CAMS');
  });

  test('sets nullable fields to null', () => {
    const result = transformTrusteeAppointmentToRow(baseEvent);
    expect(result.COMMENTS).toBeNull();
    expect(result.HEARING_SEQUENCE).toBeNull();
    expect(result.REGION_CODE).toBeNull();
    expect(result.RGN_CREATE_DATE).toBeNull();
    expect(result.RGN_CREATE_DATE_DT).toBeNull();
  });

  test('RECORD_SEQ_NBR is always 1', () => {
    expect(transformTrusteeAppointmentToRow(baseEvent).RECORD_SEQ_NBR).toBe(1);
  });

  test('DELETE_CODE is a single space', () => {
    expect(transformTrusteeAppointmentToRow(baseEvent).DELETE_CODE).toBe(' ');
  });

  test('throws when acmsProfessionalId is absent — handler validation prevents this at runtime', () => {
    expect(() =>
      transformTrusteeAppointmentToRow({
        ...baseEvent,
        acmsProfessionalId: null as unknown as string,
      }),
    ).toThrow();
  });

  test('active event with appointedDate sets LAST_UPDATED to new Date(appointedDate)', () => {
    const result = transformTrusteeAppointmentToRow({
      ...baseEvent,
      appointedDate: '2024-09-01',
    });
    expect(result.LAST_UPDATED).toEqual(new Date('2024-09-01'));
  });

  test('active event without appointedDate sets LAST_UPDATED to new Date(assignedOn)', () => {
    const result = transformTrusteeAppointmentToRow(baseEvent);
    expect(result.LAST_UPDATED).toEqual(new Date('2024-11-15T10:00:00Z'));
  });

  test('closed event sets LAST_UPDATED to new Date(unassignedOn)', () => {
    const result = transformTrusteeAppointmentToRow({
      ...baseEvent,
      unassignedOn: '2024-11-20T15:30:00Z',
    });
    expect(result.LAST_UPDATED).toEqual(new Date('2024-11-20T15:30:00Z'));
  });
});

// ─── serializeError ───────────────────────────────────────────────────────────

describe('serializeError', () => {
  test('serializes an Error into a plain object with name, message, and stack', () => {
    const error = new Error('something went wrong');
    const result = serializeError(error);
    expect(result).toEqual(
      expect.objectContaining({ name: 'Error', message: 'something went wrong' }),
    );
    expect(typeof result.stack).toBe('string');
    expect(result).not.toBeInstanceOf(Error);
  });

  test('serializes a non-Error into a raw string wrapper', () => {
    expect(serializeError('plain string')).toEqual({ raw: 'plain string' });
    expect(serializeError(42)).toEqual({ raw: '42' });
    expect(serializeError(null)).toEqual({ raw: 'null' });
  });

  test('preserves custom error names', () => {
    const error = new ValidationError('bad input');
    const result = serializeError(error);
    expect(result.name).toBe('ValidationError');
    expect(result.message).toBe('bad input');
  });
});

// ─── ValidationError ──────────────────────────────────────────────────────────

describe('ValidationError', () => {
  test('is an instance of Error', () => {
    const err = new ValidationError('test');
    expect(err).toBeInstanceOf(Error);
  });

  test('has name ValidationError', () => {
    expect(new ValidationError('test').name).toBe('ValidationError');
  });
});
