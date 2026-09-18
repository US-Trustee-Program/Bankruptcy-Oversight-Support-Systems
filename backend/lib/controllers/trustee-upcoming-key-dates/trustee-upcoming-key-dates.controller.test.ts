import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import {
  TrusteeUpcomingKeyDatesController,
  KEY_DATE_FEATURE_FLAGS,
} from './trustee-upcoming-key-dates.controller';
import { TrusteeUpcomingKeyDatesUseCase } from '../../use-cases/trustee-upcoming-key-dates/trustee-upcoming-key-dates';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import HttpStatusCodes from '@common/api/http-status-codes';
import { NotFoundError } from '../../common-errors/not-found-error';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { CamsRole } from '@common/cams/roles';

function buildMockDocument(): TrusteeUpcomingKeyDates {
  return {
    id: 'test-id-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-001',
    appointmentId: 'appointment-001',
    createdBy: SYSTEM_USER_REFERENCE,
    createdOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-01-01T00:00:00.000Z',
  };
}

describe('TrusteeUpcomingKeyDatesController', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    context.featureFlags['display-chpt7-panel-upcoming-key-dates'] = true;
    context.session.user.roles = [CamsRole.TrusteeAdmin];
  });

  test('KEY_DATE_FEATURE_FLAGS contains the exact set of expected flags', () => {
    expect(KEY_DATE_FEATURE_FLAGS).toEqual([
      'display-chpt7-panel-upcoming-key-dates',
      'display-chpt11-subv-past-key-dates',
      'display-chpt12-13-case-by-case-upcoming-key-dates',
      'display-chpt12-standing-key-dates',
      'display-chpt13-standing-key-dates',
      'display-chpt7-elected-key-dates',
    ]);
  });

  test('throws NotFoundError when all key-dates flags are disabled', async () => {
    KEY_DATE_FEATURE_FLAGS.forEach((f) => {
      context.featureFlags[f] = false;
    });
    context.request = mockCamsHttpRequest({
      method: 'GET',
      params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
    });

    const controller = new TrusteeUpcomingKeyDatesController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow(
      new NotFoundError(expect.anything()),
    );
  });

  test.each(KEY_DATE_FEATURE_FLAGS)('GET succeeds when only %s flag is enabled', async (flag) => {
    KEY_DATE_FEATURE_FLAGS.forEach((f) => {
      context.featureFlags[f] = false;
    });
    context.featureFlags[flag] = true;
    vi.spyOn(TrusteeUpcomingKeyDatesUseCase.prototype, 'getUpcomingKeyDates').mockResolvedValue(
      null,
    );
    context.request = mockCamsHttpRequest({
      method: 'GET',
      params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
    });

    const controller = new TrusteeUpcomingKeyDatesController(context);
    const response = await controller.handleRequest(context);

    expect(response.statusCode).toBe(HttpStatusCodes.OK);
    expect(response.body).toEqual({ data: null });
  });

  test('GET returns 200 with document when found', async () => {
    const mockDoc = buildMockDocument();
    const getSpy = vi
      .spyOn(TrusteeUpcomingKeyDatesUseCase.prototype, 'getUpcomingKeyDates')
      .mockResolvedValue(mockDoc);

    context.request = mockCamsHttpRequest({
      method: 'GET',
      params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
    });

    const controller = new TrusteeUpcomingKeyDatesController(context);
    const response = await controller.handleRequest(context);

    expect(response.statusCode).toBe(HttpStatusCodes.OK);
    expect(response.body).toEqual({ data: mockDoc });
    expect(getSpy).toHaveBeenCalledWith('appointment-001');
  });

  test('GET returns 200 with null when no document exists', async () => {
    const getSpy = vi
      .spyOn(TrusteeUpcomingKeyDatesUseCase.prototype, 'getUpcomingKeyDates')
      .mockResolvedValue(null);

    context.request = mockCamsHttpRequest({
      method: 'GET',
      params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
    });

    const controller = new TrusteeUpcomingKeyDatesController(context);
    const response = await controller.handleRequest(context);

    expect(response.statusCode).toBe(HttpStatusCodes.OK);
    expect(response.body).toEqual({ data: null });
    expect(getSpy).toHaveBeenCalledWith('appointment-001');
  });

  test.each([
    ['trusteeId is missing', '', 'appointment-001'],
    ['appointmentId is missing', 'trustee-001', ''],
    ['both params are missing', '', ''],
  ])('throws BadRequestError when %s', async (_desc, trusteeId, appointmentId) => {
    context.request = mockCamsHttpRequest({
      method: 'GET',
      params: { trusteeId, appointmentId },
    });

    const controller = new TrusteeUpcomingKeyDatesController(context);

    await expect(controller.handleRequest(context)).rejects.toMatchObject({
      status: 400,
    });
  });

  describe('PUT', () => {
    function buildValidInput(
      overrides: Partial<TrusteeUpcomingKeyDatesInput> = {},
    ): TrusteeUpcomingKeyDatesInput {
      return {
        trusteeId: 'trustee-001',
        appointmentId: 'appointment-001',
        pastFieldExam: '2026-06-15',
        pastBackgroundQuestion: null,
        pastAudit: null,
        pastTprSubmission: null,
        lastTprSubmitted: null,
        tprReviewPeriodStart: null,
        tprReviewPeriodEnd: null,
        tprDue: null,
        tprDueYearType: null,
        tprFrequency: null,
        tirReviewPeriodStart: null,
        tirReviewPeriodEnd: null,
        tirSubmission: null,
        tirReview: null,
        tirFrequency: null,
        tirSemiAnnualReviewPeriodStart: null,
        tirSemiAnnualReviewPeriodEnd: null,
        tirSemiAnnualSubmission: null,
        tirSemiAnnualReview: null,
        upcomingExamOrAuditYear: null,
        upcomingExamOrAuditType: null,
        lastAuditFiscalYear: null,
        auditCompletionYear: null,
        auditCompletionStatus: null,
        tprCompletionYear: null,
        tprCompletionStatus: null,
        lastMonthlyReportReceived: null,
        leaseExpiration: null,
        idExpiration: null,
        lastCompensationStudy: null,
        bondIssuedDate: null,
        bondRenewalDate: null,
        ...overrides,
      };
    }

    test('PUT returns 401 when user lacks TrusteeAdmin role', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];
      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body: buildValidInput(),
      });

      const controller = new TrusteeUpcomingKeyDatesController(context);

      await expect(controller.handleRequest(context)).rejects.toThrow(UnauthorizedError);
    });

    test('PUT returns 401 when user roles are undefined', async () => {
      delete context.session.user.roles;
      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body: buildValidInput(),
      });

      const controller = new TrusteeUpcomingKeyDatesController(context);

      await expect(controller.handleRequest(context)).rejects.toThrow(UnauthorizedError);
    });

    test('PUT with valid ISO body returns 200', async () => {
      const putSpy = vi
        .spyOn(TrusteeUpcomingKeyDatesUseCase.prototype, 'upsertUpcomingKeyDates')
        .mockResolvedValue(undefined);

      const body = buildValidInput();
      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body,
      });

      const controller = new TrusteeUpcomingKeyDatesController(context);
      const response = await controller.handleRequest(context);

      expect(response.statusCode).toBe(HttpStatusCodes.OK);
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        body,
        context.session.user,
      );
    });

    test('PUT with display-format date returns 400', async () => {
      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body: buildValidInput({ pastFieldExam: '06/15/2026' }),
      });

      const controller = new TrusteeUpcomingKeyDatesController(context);

      await expect(controller.handleRequest(context)).rejects.toMatchObject({
        status: 400,
      });
    });

    test('PUT with tprReviewPeriodStart set but tprReviewPeriodEnd null returns 400', async () => {
      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body: buildValidInput({ tprReviewPeriodStart: '1900-03-01', tprReviewPeriodEnd: null }),
      });

      const controller = new TrusteeUpcomingKeyDatesController(context);

      await expect(controller.handleRequest(context)).rejects.toMatchObject({
        status: 400,
      });
    });

    test('PUT with auditCompletionYear set but auditCompletionStatus null returns 400', async () => {
      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body: buildValidInput({ auditCompletionYear: 2026, auditCompletionStatus: null }),
      });

      const controller = new TrusteeUpcomingKeyDatesController(context);

      await expect(controller.handleRequest(context)).rejects.toMatchObject({
        status: 400,
      });
    });

    test('PUT with tprCompletionYear set but tprCompletionStatus null returns 400', async () => {
      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body: buildValidInput({ tprCompletionYear: 2026, tprCompletionStatus: null }),
      });

      const controller = new TrusteeUpcomingKeyDatesController(context);

      await expect(controller.handleRequest(context)).rejects.toMatchObject({
        status: 400,
      });
    });

    test.each([
      { name: 'lastCompensationStudy', overrides: { lastCompensationStudy: '2024-06-01' } },
      { name: 'tprFrequency', overrides: { tprFrequency: 'SEMI_ANNUAL' as const } },
      {
        name: 'tprDue and tprDueYearType',
        overrides: { tprDue: '1900-09-15', tprDueYearType: 'EVEN' as const },
      },
      {
        name: 'auditCompletionYear and auditCompletionStatus',
        overrides: { auditCompletionYear: 2026, auditCompletionStatus: 'CLOSED' as const },
      },
      {
        name: 'tprCompletionYear and tprCompletionStatus',
        overrides: { tprCompletionYear: 2026, tprCompletionStatus: 'COMPLETE' as const },
      },
      {
        name: 'lastTprSubmitted',
        overrides: { lastTprSubmitted: '2026-01-15' },
      },
    ])('PUT with $name set passes through to use case', async ({ overrides }) => {
      const putSpy = vi
        .spyOn(TrusteeUpcomingKeyDatesUseCase.prototype, 'upsertUpcomingKeyDates')
        .mockResolvedValue(undefined);

      const body = buildValidInput(overrides);
      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body,
      });

      const controller = new TrusteeUpcomingKeyDatesController(context);
      const response = await controller.handleRequest(context);

      expect(response.statusCode).toBe(HttpStatusCodes.OK);
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        body,
        context.session.user,
      );
    });
  });
});
