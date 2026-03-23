import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeUpcomingReportDatesController } from './trustee-upcoming-report-dates.controller';
import { TrusteeUpcomingReportDatesUseCase } from '../../use-cases/trustee-upcoming-report-dates/trustee-upcoming-report-dates';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import {
  TrusteeUpcomingReportDates,
  TrusteeUpcomingReportDatesInput,
} from '@common/cams/trustee-upcoming-report-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import HttpStatusCodes from '@common/api/http-status-codes';
import { NotFoundError } from '../../common-errors/not-found-error';

function buildMockDocument(
  overrides: Partial<TrusteeUpcomingReportDates> = {},
): TrusteeUpcomingReportDates {
  return {
    id: 'test-id-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-001',
    appointmentId: 'appointment-001',
    createdBy: SYSTEM_USER_REFERENCE,
    createdOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('TrusteeUpcomingReportDatesController', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.featureFlags['display-chpt7-panel-upcoming-report-dates'] = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('throws NotFoundError when display-chpt7-panel-upcoming-report-dates flag is disabled', async () => {
    context.featureFlags['display-chpt7-panel-upcoming-report-dates'] = false;
    context.request = mockCamsHttpRequest({
      method: 'GET',
      params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
    });

    const controller = new TrusteeUpcomingReportDatesController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow(
      new NotFoundError(expect.anything()),
    );
  });

  test('GET returns 200 with document when found', async () => {
    const mockDoc = buildMockDocument();
    vi.spyOn(
      TrusteeUpcomingReportDatesUseCase.prototype,
      'getUpcomingReportDates',
    ).mockResolvedValue(mockDoc);

    context.request = mockCamsHttpRequest({
      method: 'GET',
      params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
    });

    const controller = new TrusteeUpcomingReportDatesController(context);
    const response = await controller.handleRequest(context);

    expect(response.statusCode).toBe(HttpStatusCodes.OK);
    expect(response.body).toEqual({ data: mockDoc });
  });

  test('GET returns 200 with null when no document exists', async () => {
    vi.spyOn(
      TrusteeUpcomingReportDatesUseCase.prototype,
      'getUpcomingReportDates',
    ).mockResolvedValue(null);

    context.request = mockCamsHttpRequest({
      method: 'GET',
      params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
    });

    const controller = new TrusteeUpcomingReportDatesController(context);
    const response = await controller.handleRequest(context);

    expect(response.statusCode).toBe(HttpStatusCodes.OK);
    expect(response.body).toEqual({ data: null });
  });

  test('throws BadRequestError when trusteeId is missing', async () => {
    context.request = mockCamsHttpRequest({
      method: 'GET',
      params: { trusteeId: '', appointmentId: 'appointment-001' },
    });

    const controller = new TrusteeUpcomingReportDatesController(context);

    await expect(controller.handleRequest(context)).rejects.toMatchObject({
      status: 400,
    });
  });

  test('throws BadRequestError when appointmentId is missing', async () => {
    context.request = mockCamsHttpRequest({
      method: 'GET',
      params: { trusteeId: 'trustee-001', appointmentId: '' },
    });

    const controller = new TrusteeUpcomingReportDatesController(context);

    await expect(controller.handleRequest(context)).rejects.toMatchObject({
      status: 400,
    });
  });

  test('throws BadRequestError when both params are missing', async () => {
    context.request = mockCamsHttpRequest({
      method: 'GET',
      params: { trusteeId: '', appointmentId: '' },
    });

    const controller = new TrusteeUpcomingReportDatesController(context);

    await expect(controller.handleRequest(context)).rejects.toMatchObject({
      status: 400,
    });
  });

  describe('PUT', () => {
    function buildValidInput(
      overrides: Partial<TrusteeUpcomingReportDatesInput> = {},
    ): TrusteeUpcomingReportDatesInput {
      return {
        trusteeId: 'trustee-001',
        appointmentId: 'appointment-001',
        fieldExam: '2026-06-15',
        audit: null,
        tprReviewPeriodStart: null,
        tprReviewPeriodEnd: null,
        tprDue: null,
        tirReviewPeriodStart: null,
        tirReviewPeriodEnd: null,
        tirSubmission: null,
        tirReview: null,
        ...overrides,
      };
    }

    test('PUT with valid ISO body returns 200', async () => {
      vi.spyOn(
        TrusteeUpcomingReportDatesUseCase.prototype,
        'upsertUpcomingReportDates',
      ).mockResolvedValue(undefined);

      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body: buildValidInput(),
      });

      const controller = new TrusteeUpcomingReportDatesController(context);
      const response = await controller.handleRequest(context);

      expect(response.statusCode).toBe(HttpStatusCodes.OK);
    });

    test('PUT with display-format date returns 400', async () => {
      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body: buildValidInput({ fieldExam: '06/15/2026' }),
      });

      const controller = new TrusteeUpcomingReportDatesController(context);

      await expect(controller.handleRequest(context)).rejects.toMatchObject({
        status: 400,
      });
    });

    test('PUT with missing trusteeId returns 400', async () => {
      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: '', appointmentId: 'appointment-001' },
        body: buildValidInput(),
      });

      const controller = new TrusteeUpcomingReportDatesController(context);

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

      const controller = new TrusteeUpcomingReportDatesController(context);

      await expect(controller.handleRequest(context)).rejects.toMatchObject({
        status: 400,
      });
    });

    test('PUT with tprReviewPeriodEnd set but tprReviewPeriodStart null returns 400', async () => {
      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body: buildValidInput({ tprReviewPeriodStart: null, tprReviewPeriodEnd: '1900-06-30' }),
      });

      const controller = new TrusteeUpcomingReportDatesController(context);

      await expect(controller.handleRequest(context)).rejects.toMatchObject({
        status: 400,
      });
    });

    test('PUT with tirReviewPeriodStart set but tirReviewPeriodEnd null returns 400', async () => {
      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body: buildValidInput({ tirReviewPeriodStart: '1900-03-01', tirReviewPeriodEnd: null }),
      });

      const controller = new TrusteeUpcomingReportDatesController(context);

      await expect(controller.handleRequest(context)).rejects.toMatchObject({
        status: 400,
      });
    });

    test('PUT with tirReviewPeriodEnd set but tirReviewPeriodStart null returns 400', async () => {
      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body: buildValidInput({ tirReviewPeriodStart: null, tirReviewPeriodEnd: '1900-06-30' }),
      });

      const controller = new TrusteeUpcomingReportDatesController(context);

      await expect(controller.handleRequest(context)).rejects.toMatchObject({
        status: 400,
      });
    });

    test('PUT with both tpr review period fields set returns 200', async () => {
      vi.spyOn(
        TrusteeUpcomingReportDatesUseCase.prototype,
        'upsertUpcomingReportDates',
      ).mockResolvedValue(undefined);

      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body: buildValidInput({
          tprReviewPeriodStart: '1900-03-01',
          tprReviewPeriodEnd: '1900-06-30',
        }),
      });

      const controller = new TrusteeUpcomingReportDatesController(context);
      const response = await controller.handleRequest(context);

      expect(response.statusCode).toBe(HttpStatusCodes.OK);
    });

    test('PUT with both tir review period fields set returns 200', async () => {
      vi.spyOn(
        TrusteeUpcomingReportDatesUseCase.prototype,
        'upsertUpcomingReportDates',
      ).mockResolvedValue(undefined);

      context.request = mockCamsHttpRequest({
        method: 'PUT',
        params: { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
        body: buildValidInput({
          tirReviewPeriodStart: '1900-03-01',
          tirReviewPeriodEnd: '1900-06-30',
        }),
      });

      const controller = new TrusteeUpcomingReportDatesController(context);
      const response = await controller.handleRequest(context);

      expect(response.statusCode).toBe(HttpStatusCodes.OK);
    });
  });
});
