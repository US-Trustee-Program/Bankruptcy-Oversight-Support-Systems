import { expect } from 'vitest';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import {
  TestSetup,
  waitForAppLoad,
  expectPageToContain,
  getElementByTestId,
} from '../../helpers/fluent-test-setup';
import MockData from '@common/cams/test-utilities/mock-data';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * BDD Feature: View Trustee Appointments with Grouping and Sorting (Full Stack)
 *
 * As a USTP Trustee Administrator
 * I want to view trustee appointments grouped by district and sorted by city and chapter
 * So that I can easily find and review appointments in an organized manner
 *
 * This test suite exercises the COMPLETE stack:
 * - React components (TrusteeAppointments, AppointmentCard)
 * - API client (api2.ts)
 * - Express server
 * - Controllers (TrusteesController)
 * - Use cases (TrusteesUseCase)
 * - Repositories (TrusteeAppointmentsMongoRepository)
 *
 * Code Coverage:
 * - user-interface/src/trustees/panels/TrusteeAppointments.tsx
 * - user-interface/src/trustees/panels/AppointmentCard.tsx
 * - backend/lib/controllers/trustees/trustees.controller.ts
 * - backend/lib/use-cases/trustees/trustees.ts
 *
 * Acceptance Criteria:
 * - Appointments must be grouped by district (courtName)
 * - Within each district group, appointments must be sorted alphabetically by city (courtDivisionName)
 * - Within the same city, appointments must be sorted by chapter in ascending order (7, 11, 12, 13)
 *
 * Migration Date: 2026-02-12
 */
describe('Feature: View Trustee Appointments with Grouping and Sorting (Full Stack)', () => {
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
   * Scenario: View appointments grouped by district and sorted by city and chapter
   *
   * GIVEN a trustee has multiple appointments across different districts and cities
   * WHEN the user views the trustee's appointments
   * THEN the appointments should be grouped by district
   * AND within each group, sorted alphabetically by city
   * AND within the same city, sorted by chapter in ascending order
   *
   * Replaces:
   * - TrusteeAppointments.test.tsx: New grouping/sorting tests
   */
  test('should display appointments grouped by district and sorted by city then chapter', async () => {
    // GIVEN: A trustee with multiple appointments across different districts and cities
    const testTrustee = MockData.getTrustee({
      trusteeId: '123',
      name: 'John Doe',
    });

    const appointments: TrusteeAppointment[] = [
      // Intentionally out of order to test sorting
      {
        id: 'appointment-001',
        trusteeId: '123',
        chapter: '13',
        appointmentType: 'standing',
        courtId: '082',
        courtDivisionName: 'Brooklyn',
        courtName: 'Eastern District of New York',
        divisionCode: '1',
        status: 'active',
        appointedDate: '2020-01-15T00:00:00.000Z',
        effectiveDate: '2020-01-15T00:00:00.000Z',
        createdOn: '2020-01-10T14:30:00.000Z',
        createdBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2020-01-10T14:30:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      },
      {
        id: 'appointment-002',
        trusteeId: '123',
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        courtDivisionName: 'White Plains',
        courtName: 'Southern District of New York',
        divisionCode: '2',
        status: 'active',
        appointedDate: '2019-03-22T00:00:00.000Z',
        effectiveDate: '2019-03-22T00:00:00.000Z',
        createdOn: '2019-03-15T10:00:00.000Z',
        createdBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2019-03-15T10:00:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      },
      {
        id: 'appointment-003',
        trusteeId: '123',
        chapter: '11',
        appointmentType: 'case-by-case',
        courtId: '081',
        courtDivisionName: 'Manhattan',
        courtName: 'Southern District of New York',
        divisionCode: '3',
        status: 'active',
        appointedDate: '2021-06-10T00:00:00.000Z',
        effectiveDate: '2021-06-10T00:00:00.000Z',
        createdOn: '2021-06-05T10:00:00.000Z',
        createdBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2021-06-05T10:00:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      },
      {
        id: 'appointment-004',
        trusteeId: '123',
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        courtDivisionName: 'Manhattan',
        courtName: 'Southern District of New York',
        divisionCode: '4',
        status: 'active',
        appointedDate: '2018-11-01T00:00:00.000Z',
        effectiveDate: '2018-11-01T00:00:00.000Z',
        createdOn: '2018-10-25T10:00:00.000Z',
        createdBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2018-10-25T10:00:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      },
      {
        id: 'appointment-005',
        trusteeId: '123',
        chapter: '11',
        appointmentType: 'case-by-case',
        courtId: '082',
        courtDivisionName: 'Brooklyn',
        courtName: 'Eastern District of New York',
        divisionCode: '5',
        status: 'active',
        appointedDate: '2022-02-14T00:00:00.000Z',
        effectiveDate: '2022-02-14T00:00:00.000Z',
        createdOn: '2022-02-10T10:00:00.000Z',
        createdBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2022-02-10T10:00:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      },
    ];

    // Setup test with trustee and appointments
    await TestSetup.forUser(TestSessions.trusteeAdmin())
      .withFeatureFlag('trustee-management', true)
      .withCommonPostLoginMocks()
      .withTrustee(testTrustee)
      .withCustomSpy('TrusteeAppointmentsMongoRepository', {
        getTrusteeAppointments: vi.fn().mockResolvedValue(appointments),
      })
      .renderAt(`/trustees/${testTrustee.trusteeId}`);

    await waitForAppLoad();

    // WHEN: User clicks on the Appointments tab
    const appointmentsTab = await getElementByTestId('tab-appointments');
    appointmentsTab.click();

    // Wait for appointments to load
    await waitForAppLoad();

    // THEN: All appointments should be displayed
    await expectPageToContain('Eastern District of New York');
    await expectPageToContain('Southern District of New York');
    await expectPageToContain('Brooklyn');
    await expectPageToContain('Manhattan');
    await expectPageToContain('White Plains');

    // AND: Appointments should be in the correct order:
    // 1. Eastern District - Brooklyn - Chapter 11
    // 2. Eastern District - Brooklyn - Chapter 13
    // 3. Southern District - Manhattan - Chapter 7
    // 4. Southern District - Manhattan - Chapter 11
    // 5. Southern District - White Plains - Chapter 7

    const appointmentCards = document.querySelectorAll('.appointment-card-container');
    expect(appointmentCards).toHaveLength(5);

    // Verify first appointment: Eastern District - Brooklyn - Chapter 11
    const firstCard = appointmentCards[0];
    expect(firstCard.textContent).toContain('Eastern District of New York');
    expect(firstCard.textContent).toContain('Brooklyn');
    expect(firstCard.textContent).toContain('Chapter 11');

    // Verify second appointment: Eastern District - Brooklyn - Chapter 13
    const secondCard = appointmentCards[1];
    expect(secondCard.textContent).toContain('Eastern District of New York');
    expect(secondCard.textContent).toContain('Brooklyn');
    expect(secondCard.textContent).toContain('Chapter 13');

    // Verify third appointment: Southern District - Manhattan - Chapter 7
    const thirdCard = appointmentCards[2];
    expect(thirdCard.textContent).toContain('Southern District of New York');
    expect(thirdCard.textContent).toContain('Manhattan');
    expect(thirdCard.textContent).toContain('Chapter 7');

    // Verify fourth appointment: Southern District - Manhattan - Chapter 11
    const fourthCard = appointmentCards[3];
    expect(fourthCard.textContent).toContain('Southern District of New York');
    expect(fourthCard.textContent).toContain('Manhattan');
    expect(fourthCard.textContent).toContain('Chapter 11');

    // Verify fifth appointment: Southern District - White Plains - Chapter 7
    const fifthCard = appointmentCards[4];
    expect(fifthCard.textContent).toContain('Southern District of New York');
    expect(fifthCard.textContent).toContain('White Plains');
    expect(fifthCard.textContent).toContain('Chapter 7');

    console.log(
      '[TEST] ✓ Appointments displayed in correct order: grouped by district, sorted by city then chapter',
    );
  });

  /**
   * Scenario: View appointments with single district and multiple cities
   *
   * GIVEN a trustee has appointments in multiple cities within one district
   * WHEN the user views the trustee's appointments
   * THEN the appointments should be sorted alphabetically by city
   * AND within the same city, sorted by chapter in ascending order
   */
  test('should sort appointments alphabetically by city within a single district', async () => {
    // GIVEN: A trustee with appointments in one district, multiple cities
    const testTrustee = MockData.getTrustee({
      trusteeId: '456',
      name: 'Jane Smith',
    });

    const appointments: TrusteeAppointment[] = [
      {
        id: 'appointment-001',
        trusteeId: '456',
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        courtDivisionName: 'White Plains',
        courtName: 'Southern District of New York',
        divisionCode: '1',
        status: 'active',
        appointedDate: '2020-01-15T00:00:00.000Z',
        effectiveDate: '2020-01-15T00:00:00.000Z',
        createdOn: '2020-01-10T14:30:00.000Z',
        createdBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2020-01-10T14:30:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      },
      {
        id: 'appointment-002',
        trusteeId: '456',
        chapter: '11',
        appointmentType: 'case-by-case',
        courtId: '081',
        courtDivisionName: 'Manhattan',
        courtName: 'Southern District of New York',
        divisionCode: '2',
        status: 'active',
        appointedDate: '2019-03-22T00:00:00.000Z',
        effectiveDate: '2019-03-22T00:00:00.000Z',
        createdOn: '2019-03-15T10:00:00.000Z',
        createdBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2019-03-15T10:00:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      },
      {
        id: 'appointment-003',
        trusteeId: '456',
        chapter: '13',
        appointmentType: 'standing',
        courtId: '081',
        courtDivisionName: 'Albany',
        courtName: 'Southern District of New York',
        divisionCode: '3',
        status: 'active',
        appointedDate: '2021-06-10T00:00:00.000Z',
        effectiveDate: '2021-06-10T00:00:00.000Z',
        createdOn: '2021-06-05T10:00:00.000Z',
        createdBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2021-06-05T10:00:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      },
    ];

    // Setup test with trustee and appointments
    await TestSetup.forUser(TestSessions.trusteeAdmin())
      .withFeatureFlag('trustee-management', true)
      .withCommonPostLoginMocks()
      .withTrustee(testTrustee)
      .withCustomSpy('TrusteeAppointmentsMongoRepository', {
        getTrusteeAppointments: vi.fn().mockResolvedValue(appointments),
      })
      .renderAt(`/trustees/${testTrustee.trusteeId}`);

    await waitForAppLoad();

    // WHEN: User clicks on the Appointments tab
    const appointmentsTab = await getElementByTestId('tab-appointments');
    appointmentsTab.click();

    await waitForAppLoad();

    // THEN: Appointments should be sorted alphabetically by city
    const appointmentCards = document.querySelectorAll('.appointment-card-container');
    expect(appointmentCards).toHaveLength(3);

    // Get cities in order
    const cities = Array.from(appointmentCards).map((card) => {
      const heading = card.querySelector('.appointment-card-heading');
      const match = heading?.textContent?.match(/\(([^)]+)\)/);
      return match ? match[1] : '';
    });

    // Verify cities are in alphabetical order: Albany, Manhattan, White Plains
    expect(cities).toEqual(['Albany', 'Manhattan', 'White Plains']);

    console.log('[TEST] ✓ Appointments sorted alphabetically by city');
  });

  /**
   * Scenario: View appointments with same city and district but different chapters
   *
   * GIVEN a trustee has multiple appointments in the same city and district
   * WHEN the user views the trustee's appointments
   * THEN the appointments should be sorted by chapter in ascending order
   */
  test('should sort appointments by chapter in ascending order within the same city', async () => {
    // GIVEN: A trustee with appointments in the same district and city
    const testTrustee = MockData.getTrustee({
      trusteeId: '789',
      name: 'Bob Johnson',
    });

    const appointments: TrusteeAppointment[] = [
      {
        id: 'appointment-001',
        trusteeId: '789',
        chapter: '13',
        appointmentType: 'standing',
        courtId: '081',
        courtDivisionName: 'Manhattan',
        courtName: 'Southern District of New York',
        divisionCode: '1',
        status: 'active',
        appointedDate: '2020-01-15T00:00:00.000Z',
        effectiveDate: '2020-01-15T00:00:00.000Z',
        createdOn: '2020-01-10T14:30:00.000Z',
        createdBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2020-01-10T14:30:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      },
      {
        id: 'appointment-002',
        trusteeId: '789',
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        courtDivisionName: 'Manhattan',
        courtName: 'Southern District of New York',
        divisionCode: '2',
        status: 'active',
        appointedDate: '2019-03-22T00:00:00.000Z',
        effectiveDate: '2019-03-22T00:00:00.000Z',
        createdOn: '2019-03-15T10:00:00.000Z',
        createdBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2019-03-15T10:00:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      },
      {
        id: 'appointment-003',
        trusteeId: '789',
        chapter: '11',
        appointmentType: 'case-by-case',
        courtId: '081',
        courtDivisionName: 'Manhattan',
        courtName: 'Southern District of New York',
        divisionCode: '3',
        status: 'active',
        appointedDate: '2021-06-10T00:00:00.000Z',
        effectiveDate: '2021-06-10T00:00:00.000Z',
        createdOn: '2021-06-05T10:00:00.000Z',
        createdBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2021-06-05T10:00:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      },
    ];

    // Setup test with trustee and appointments
    await TestSetup.forUser(TestSessions.trusteeAdmin())
      .withFeatureFlag('trustee-management', true)
      .withCommonPostLoginMocks()
      .withTrustee(testTrustee)
      .withCustomSpy('TrusteeAppointmentsMongoRepository', {
        getTrusteeAppointments: vi.fn().mockResolvedValue(appointments),
      })
      .renderAt(`/trustees/${testTrustee.trusteeId}`);

    await waitForAppLoad();

    // WHEN: User clicks on the Appointments tab
    const appointmentsTab = await getElementByTestId('tab-appointments');
    appointmentsTab.click();

    await waitForAppLoad();

    // THEN: Appointments should be sorted by chapter in ascending order
    const appointmentCards = document.querySelectorAll('.appointment-card-container');
    expect(appointmentCards).toHaveLength(3);

    // Get chapters in order
    const chapters = Array.from(appointmentCards).map((card) => {
      const heading = card.querySelector('.appointment-card-heading');
      const match = heading?.textContent?.match(/Chapter (\d+)/);
      return match ? match[1] : '';
    });

    // Verify chapters are in ascending order: 7, 11, 13
    expect(chapters).toEqual(['7', '11', '13']);

    console.log('[TEST] ✓ Appointments sorted by chapter in ascending order');
  });
});
