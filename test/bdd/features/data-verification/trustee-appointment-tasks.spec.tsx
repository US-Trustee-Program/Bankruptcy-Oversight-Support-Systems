import { vi } from 'vitest';
import { screen } from '@testing-library/react';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import { TestSetup, waitForAppLoad } from '../../helpers/fluent-test-setup';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/test-utilities/offices.mock';
import { ustpOfficeToCourtDivision } from '@common/cams/courts';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { TrusteeAppointmentVerification } from '@common/cams/trustee-appointment-verification';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * BDD Feature: Trustee appointment tasks in the Data Verification queue (Full Stack)
 *
 * As a data verifier
 * I want cases assigned to a trustee with no active appointment for their court, division and
 * chapter to show up as tasks in the Data Verification queue
 * So that I can find and investigate the trustee's missing appointment
 *
 * Gherkin: test/bdd2/specs/CAMS-956-trustee-appointment-verification.feature, Slice 1 scenario
 * "The Data Verification queue shows the new task type".
 *
 * Exercises: DataVerificationScreen + TrusteeAppointmentVerificationRow -> api2 -> Express ->
 * TrusteeAppointmentVerificationController -> listAppointmentTasks (court names from offices)
 * -> TrusteeAppointmentVerificationMongoRepository.search (spied).
 */
describe('Feature: Trustee appointment tasks in the Data Verification queue (Full Stack)', () => {
  beforeAll(async () => {
    await initializeTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer();
  });

  afterEach(async () => {
    await clearAllRepositorySpies();
  });

  /**
   * Scenario: The Data Verification queue shows the new task type
   *
   * GIVEN an open appointment task exists for a trustee in a court, division and chapter
   * WHEN a data verifier opens the Data Verification queue
   * THEN the appointment task appears alongside the existing task types
   * AND it is titled by its court, division and chapter
   */
  test('lists an open appointment task titled by its court, division and chapter', async () => {
    // GIVEN: a court and division the backend can name from the offices list
    const office = MOCKED_USTP_OFFICES_ARRAY[0];
    const court = ustpOfficeToCourtDivision(office)[0];
    const task: TrusteeAppointmentVerification = {
      id: 'appointment-task-1',
      documentType: 'TRUSTEE_APPOINTMENT_VERIFICATION',
      taskType: 'trustee-appointment',
      trusteeId: 'trustee-1',
      courtId: court.courtId,
      divisionCode: court.courtDivisionCode,
      chapter: '7',
      reason: 'no-appointment',
      caseIds: ['081-24-00001'],
      status: 'pending',
      createdOn: '2026-11-01T00:00:00.000Z',
      createdBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2026-11-01T00:00:00.000Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    // WHEN: a data verifier opens the queue
    await TestSetup.forUser(TestSessions.dataVerifier())
      .withFeatureFlag('trustee-verification-enabled')
      .withOffices([office])
      .withTrusteeAppointmentTasks([task])
      .withCustomSpy('OrdersMongoRepository', { search: vi.fn().mockResolvedValue([]) })
      .withCustomSpy('ConsolidationOrdersMongoRepository', {
        search: vi.fn().mockResolvedValue([]),
      })
      .renderAt('/data-verification');

    await waitForAppLoad();

    // THEN: the task is listed with its type label and court/division/chapter subject
    const row = await screen.findByTestId(`accordion-heading-${task.id}`, {}, { timeout: 10000 });
    expect(row.textContent).toContain('Trustee Appointment');
    expect(row.textContent).toContain(`${court.courtName} (${court.courtDivisionName}): Chapter 7`);
  }, 30000);
});
