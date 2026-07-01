import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import MockData from '@common/cams/test-utilities/mock-data';
import { MODULE_NAME, TrusteesUseCase } from './trustees';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { getCamsUserReference } from '@common/cams/session';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsError } from '../../common-errors/cams-error';
import { NotFoundError } from '../../common-errors/not-found-error';
import { FIELD_VALIDATION_MESSAGES } from '@common/cams/validation-messages';
import { CourtsUseCase } from '../courts/courts';
import { CourtDivisionDetails } from '@common/cams/courts';
import { MockNotificationGateway } from '../../testing/mock-gateways/mock-notification.gateway';
import { AppointmentChapterType } from '@common/cams/trustees';
import { ContactInformation } from '@common/cams/contact';

describe('TrusteesUseCase tests', () => {
  let context: ApplicationContext;
  let trusteesUseCase: TrusteesUseCase;

  const TEST_COMPANY_NAME = 'Test Company LLC';
  const UPDATED_COMPANY_NAME = 'Updated Company LLC';

  describe('createTrustee', () => {
    beforeEach(async () => {
      vi.restoreAllMocks();
      context = await createMockApplicationContext();
      trusteesUseCase = new TrusteesUseCase(context);
    });

    test('should create a trustee', async () => {
      const trustee = MockData.getTrusteeInput();
      const userRef = getCamsUserReference(context.session.user);

      const createTrusteeSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrustee')
        .mockResolvedValue(
          MockData.getTrustee({ ...trustee, createdBy: userRef, updatedBy: userRef }),
        );
      const trusteeHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();
      const atomicDecrementSpy = vi
        .spyOn(MockMongoRepository.prototype, 'atomicDecrement')
        .mockResolvedValue(99999);
      const createProfessionalIdSpy = vi.spyOn(
        MockMongoRepository.prototype,
        'createProfessionalId',
      );

      const actual = await trusteesUseCase.createTrustee(context, trustee);
      expect(createTrusteeSpy).toHaveBeenCalledWith(trustee, userRef);

      expect(trusteeHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          trusteeId: actual.trusteeId,
          documentType: 'AUDIT_NAME',
          after: actual.name,
          createdBy: userRef,
        }),
      );
      expect(trusteeHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          trusteeId: actual.trusteeId,
          documentType: 'AUDIT_PUBLIC_CONTACT',
          after: actual.public,
          createdBy: userRef,
        }),
      );
      expect(trusteeHistorySpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: context.session.user,
        }),
      );

      expect(atomicDecrementSpy).toHaveBeenCalledWith(
        'PROFESSIONAL_ID_COUNTER',
        'lastAssigned',
        100000,
      );
      expect(createProfessionalIdSpy).toHaveBeenCalledWith(actual.trusteeId, 'ZZ-99999', {
        id: 'SYSTEM',
        name: 'CAMS System',
      });
      expect(trusteeHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          trusteeId: actual.trusteeId,
          documentType: 'AUDIT_PROFESSIONAL_ID_ASSIGNED',
          before: undefined,
          after: 'ZZ-99999',
          createdBy: { id: 'SYSTEM', name: 'CAMS System' },
        }),
      );
    });

    test('should zero-pad professional code below 10000', async () => {
      const trustee = MockData.getTrusteeInput();
      const userRef = getCamsUserReference(context.session.user);

      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(
        MockData.getTrustee({ ...trustee, createdBy: userRef, updatedBy: userRef }),
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();
      vi.spyOn(MockMongoRepository.prototype, 'atomicDecrement').mockResolvedValue(9999);
      const createProfessionalIdSpy = vi.spyOn(
        MockMongoRepository.prototype,
        'createProfessionalId',
      );

      const actual = await trusteesUseCase.createTrustee(context, trustee);

      expect(createProfessionalIdSpy).toHaveBeenCalledWith(
        actual.trusteeId,
        'ZZ-09999',
        expect.anything(),
      );
    });

    test('should throw when atomicDecrement counter fails', async () => {
      const trustee = MockData.getTrusteeInput();
      const userRef = getCamsUserReference(context.session.user);

      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(
        MockData.getTrustee({ ...trustee, createdBy: userRef, updatedBy: userRef }),
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();
      vi.spyOn(MockMongoRepository.prototype, 'atomicDecrement').mockRejectedValue(
        new Error('counter failed'),
      );

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.createTrustee(context, trustee),
      );
      expect(actualError.isCamsError).toBe(true);
    });

    test('should throw when professional ID counter is exhausted', async () => {
      const trustee = MockData.getTrusteeInput();
      const userRef = getCamsUserReference(context.session.user);

      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(
        MockData.getTrustee({ ...trustee, createdBy: userRef, updatedBy: userRef }),
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();
      vi.spyOn(MockMongoRepository.prototype, 'atomicDecrement').mockResolvedValue(0);

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.createTrustee(context, trustee),
      );
      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain('Professional ID counter exhausted');
    });

    test('should throw when createProfessionalId fails', async () => {
      const trustee = MockData.getTrusteeInput();
      const userRef = getCamsUserReference(context.session.user);

      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(
        MockData.getTrustee({ ...trustee, createdBy: userRef, updatedBy: userRef }),
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();
      vi.spyOn(MockMongoRepository.prototype, 'createProfessionalId').mockRejectedValue(
        new Error('prof-id write failed'),
      );

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.createTrustee(context, trustee),
      );
      expect(actualError.isCamsError).toBe(true);
    });

    test('should create a trustee with company name in public contact information', async () => {
      const trusteeWithCompany = MockData.getTrusteeInput({
        public: {
          ...MockData.getTrusteeInput().public,
          companyName: TEST_COMPANY_NAME,
        },
      });
      const userRef = getCamsUserReference(context.session.user);

      const createdTrustee = MockData.getTrustee({
        ...trusteeWithCompany,
        createdBy: userRef,
        updatedBy: userRef,
      });

      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(createdTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

      const actual = await trusteesUseCase.createTrustee(context, trusteeWithCompany);

      expect(actual.public.companyName).toEqual(TEST_COMPANY_NAME);
      expect(MockMongoRepository.prototype.createTrustee).toHaveBeenCalledWith(
        expect.objectContaining({
          public: expect.objectContaining({
            companyName: TEST_COMPANY_NAME,
          }),
        }),
        userRef,
      );
    });

    test('should create a trustee without company name (optional field)', async () => {
      const trustee = MockData.getTrusteeInput();
      const userRef = getCamsUserReference(context.session.user);

      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(
        MockData.getTrustee({ ...trustee, createdBy: userRef, updatedBy: userRef }),
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

      const actual = await trusteesUseCase.createTrustee(context, trustee);

      expect(actual.public.companyName).toBeUndefined();
    });

    test('should throw BadRequestError for invalid trustee input', async () => {
      const invalidTrustee = { ...MockData.getTrusteeInput(), firstName: '' };

      await expect(trusteesUseCase.createTrustee(context, invalidTrustee)).rejects.toThrow(
        BadRequestError,
      );
    });

    test('should throw error when repository create fails', async () => {
      const trustee = MockData.getTrusteeInput();
      const repositoryError = new CamsError('Test-Module', {
        message: 'Database connection failed',
      });

      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.createTrustee(context, trustee),
      );
      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toEqual('Database connection failed');
    });

    test('should throw error when history creation fails', async () => {
      const trustee = MockData.getTrusteeInput();
      const userRef = getCamsUserReference(context.session.user);
      const historyError = new Error('History creation failed');

      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(
        MockData.getTrustee({ ...trustee, createdBy: userRef, updatedBy: userRef }),
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockRejectedValue(
        historyError,
      );

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.createTrustee(context, trustee),
      );
      expect(actualError.isCamsError).toBe(true);
    });
  });

  describe('listTrustees', () => {
    const mockCourts: CourtDivisionDetails[] = [
      {
        officeName: 'Manhattan',
        officeCode: '081',
        courtId: 'court-1',
        courtName: 'Southern District of New York',
        courtDivisionCode: '081',
        courtDivisionName: 'Manhattan',
        groupDesignator: 'NY',
        regionId: '02',
        regionName: 'Region 2',
      },
    ];

    beforeEach(async () => {
      vi.restoreAllMocks();
      context = await createMockApplicationContext();
      trusteesUseCase = new TrusteesUseCase(context);
      vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue(mockCourts);
    });

    test('should return TrusteeListItem[] with appointments attached per trustee', async () => {
      const trustee1 = MockData.getTrustee({ trusteeId: 'trustee-1', name: 'Bravo' });
      const trustee2 = MockData.getTrustee({ trusteeId: 'trustee-2', name: 'Alpha' });
      const appt1 = MockData.getTrusteeAppointment({ trusteeId: 'trustee-1' });
      const appt2 = MockData.getTrusteeAppointment({ trusteeId: 'trustee-2' });

      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([
        trustee1,
        trustee2,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        appt1,
        appt2,
      ]);

      const result = await trusteesUseCase.listTrustees(context);

      expect(result).toHaveLength(2);
      const alpha = result.find((r) => r.trusteeId === 'trustee-2');
      const bravo = result.find((r) => r.trusteeId === 'trustee-1');
      expect(alpha?.appointments).toHaveLength(1);
      expect(bravo?.appointments).toHaveLength(1);
    });

    test('should enrich appointments with courtName and courtDivisionName from courts lookup', async () => {
      const trusteeId = 'trustee-enrich';
      const trustee = MockData.getTrustee({ trusteeId });
      const appt = MockData.getTrusteeAppointment({
        trusteeId,
        courtId: 'court-1',
        divisionCode: '081',
      });

      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([trustee]);
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        appt,
      ]);

      const result = await trusteesUseCase.listTrustees(context);

      expect(result[0].appointments[0].courtName).toBe('Southern District of New York');
      expect(result[0].appointments[0].courtDivisionName).toBe('Manhattan');
    });

    test('should set courtName to undefined when courtId has no matching court', async () => {
      const trusteeId = 'trustee-unknown-court';
      const trustee = MockData.getTrustee({ trusteeId });
      const appt = MockData.getTrusteeAppointment({ trusteeId, courtId: 'unknown-court' });

      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([trustee]);
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        appt,
      ]);

      const result = await trusteesUseCase.listTrustees(context);

      expect(result[0].appointments[0].courtName).toBeUndefined();
    });

    test('should give trustees with no matching appointments an empty appointments array', async () => {
      const trustee = MockData.getTrustee({ trusteeId: 'trustee-no-appts' });

      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([trustee]);
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([]);

      const result = await trusteesUseCase.listTrustees(context);

      expect(result).toHaveLength(1);
      expect(result[0].appointments).toEqual([]);
    });

    test('should return trustees sorted by lastName ascending, then firstName as tiebreaker (case-insensitive)', async () => {
      const trusteeC = MockData.getTrustee({
        trusteeId: 'id-c',
        firstName: 'Zara',
        lastName: 'Adams',
      });
      const trusteeA = MockData.getTrustee({
        trusteeId: 'id-a',
        firstName: 'Alice',
        lastName: 'carter',
      });
      const trusteeB = MockData.getTrustee({
        trusteeId: 'id-b',
        firstName: 'bob',
        lastName: 'Adams',
      });

      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([
        trusteeC,
        trusteeA,
        trusteeB,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([]);

      const result = await trusteesUseCase.listTrustees(context);

      expect(result.map((r) => r.lastName)).toEqual(['Adams', 'Adams', 'carter']);
      expect(result.map((r) => r.firstName)).toEqual(['bob', 'Zara', 'Alice']);
    });

    test('should filter to only active trustees when status is active', async () => {
      const activeTrustee = MockData.getTrustee({ trusteeId: 'active-1' });
      const inactiveTrustee = MockData.getTrustee({ trusteeId: 'inactive-1' });
      const activeAppt = MockData.getTrusteeAppointment({
        trusteeId: 'active-1',
        status: 'active',
      });

      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeIdsByStatuses').mockResolvedValue([
        'active-1',
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([
        activeTrustee,
        inactiveTrustee,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        activeAppt,
      ]);

      const result = await trusteesUseCase.listTrustees(context, { status: 'active' });

      expect(result).toHaveLength(1);
      expect(result[0].trusteeId).toBe('active-1');
    });

    test('should filter to only inactive trustees when status is inactive', async () => {
      const activeTrustee = MockData.getTrustee({ trusteeId: 'active-1' });
      const inactiveTrustee = MockData.getTrustee({ trusteeId: 'inactive-1' });
      const inactiveAppt = MockData.getTrusteeAppointment({
        trusteeId: 'inactive-1',
        status: 'deceased',
      });

      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeIdsByStatuses').mockResolvedValue([
        'inactive-1',
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([
        activeTrustee,
        inactiveTrustee,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        inactiveAppt,
      ]);

      const result = await trusteesUseCase.listTrustees(context, { status: 'inactive' });

      expect(result).toHaveLength(1);
      expect(result[0].trusteeId).toBe('inactive-1');
      expect(MockMongoRepository.prototype.getTrusteeIdsByStatuses).toHaveBeenCalledWith(
        expect.arrayContaining([
          'inactive',
          'voluntarily-suspended',
          'involuntarily-suspended',
          'deceased',
          'resigned',
          'terminated',
          'removed',
        ]),
      );
    });

    test('should filter appointments by status when a trustee has mixed-status appointments', async () => {
      const trustee = MockData.getTrustee({ trusteeId: 'mixed-1' });
      const activeAppt = MockData.getTrusteeAppointment({ trusteeId: 'mixed-1', status: 'active' });
      const removedAppt = MockData.getTrusteeAppointment({
        trusteeId: 'mixed-1',
        status: 'removed',
      });

      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeIdsByStatuses').mockResolvedValue([
        'mixed-1',
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([trustee]);
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        activeAppt,
        removedAppt,
      ]);

      const result = await trusteesUseCase.listTrustees(context, { status: 'active' });

      expect(result).toHaveLength(1);
      expect(result[0].appointments).toHaveLength(1);
      expect(result[0].appointments[0].status).toBe('active');
    });

    test('should return all trustees when status is all', async () => {
      const trustee1 = MockData.getTrustee({ trusteeId: 't1' });
      const trustee2 = MockData.getTrustee({ trusteeId: 't2' });
      const appt1 = MockData.getTrusteeAppointment({ trusteeId: 't1', status: 'active' });
      const appt2 = MockData.getTrusteeAppointment({ trusteeId: 't2', status: 'resigned' });

      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([
        trustee1,
        trustee2,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        appt1,
        appt2,
      ]);

      const result = await trusteesUseCase.listTrustees(context, { status: 'all' });

      expect(result).toHaveLength(2);
    });

    test('should handle repository error during list operation', async () => {
      const repositoryError = new Error('Database error');

      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() => trusteesUseCase.listTrustees(context));
      expect(actualError.isCamsError).toBe(true);
    });
  });

  describe('listTrusteeHistory', () => {
    beforeEach(async () => {
      vi.restoreAllMocks();
      context = await createMockApplicationContext();
      trusteesUseCase = new TrusteesUseCase(context);
    });

    test('should return trustee history', async () => {
      const trusteeId = 'trustee-123';
      const mockHistory = [...MockData.getTrusteeHistory(), ...MockData.getTrusteeHistory()];
      vi.spyOn(MockMongoRepository.prototype, 'listTrusteeHistory').mockResolvedValue(mockHistory);

      const result = await trusteesUseCase.listTrusteeHistory(context, trusteeId);

      expect(result).toEqual(mockHistory);
    });

    test('should handle repository error during history list operation', async () => {
      const trusteeId = 'trustee-123';
      const repositoryError = new Error('History fetch failed');

      vi.spyOn(MockMongoRepository.prototype, 'listTrusteeHistory').mockRejectedValue(
        repositoryError,
      );

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.listTrusteeHistory(context, trusteeId),
      );
      expect(actualError.isCamsError).toBe(true);
    });
  });

  describe('getTrustee', () => {
    beforeEach(async () => {
      vi.restoreAllMocks();
      context = await createMockApplicationContext();
      trusteesUseCase = new TrusteesUseCase(context);
    });

    test('should return a single trustee', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee();
      const mockAssistants = [MockData.getTrusteeAssistant({ trusteeId })];

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeAssistants').mockResolvedValue(
        mockAssistants,
      );

      const result = await trusteesUseCase.getTrustee(context, trusteeId);

      expect(result).toEqual({ ...mockTrustee, assistants: mockAssistants });
    });

    test('should handle repository error when trustee not found', async () => {
      const trusteeId = 'non-existent-trustee';
      const repositoryError = new Error('Trustee not found');

      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.getTrustee(context, trusteeId),
      );
      expect(actualError.isCamsError).toBe(true);
    });
  });

  describe('updateTrustee', () => {
    beforeEach(async () => {
      vi.restoreAllMocks();
      context = await createMockApplicationContext();
      trusteesUseCase = new TrusteesUseCase(context);
    });

    const trusteeId = 'trustee-123';
    let existingTrustee: ReturnType<typeof MockData.getTrustee>;
    let userRef: ReturnType<typeof getCamsUserReference>;

    beforeEach(() => {
      existingTrustee = MockData.getTrustee();
      userRef = getCamsUserReference(context.session.user);
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingTrustee);
    });

    test('should update trustee and create name history when name changes', async () => {
      const updatedBy = getCamsUserReference(context.session.user);
      const updatedName = 'Updated Trustee Name';
      const updateData = { name: updatedName };
      const updatedTrustee = { ...existingTrustee, name: updatedName };

      const updateTrusteeSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();
      const completeTraceSpy = vi.spyOn(context.observability, 'completeTrace');

      await trusteesUseCase.updateTrustee(context, trusteeId, updateData);
      expect(updateTrusteeSpy).toHaveBeenCalledWith(trusteeId, updatedTrustee, updatedBy);
      expect(updateTrusteeSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: context.session.user }),
      );

      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_NAME',
          trusteeId,
          before: existingTrustee.name,
          after: updatedName,
          updatedBy,
          updatedOn: expect.any(String),
        }),
      );
      expect(completeTraceSpy).toHaveBeenCalledWith(
        expect.anything(),
        'Trustee Name Edited',
        expect.objectContaining({ success: true }),
        undefined,
        context.logger,
      );
      expect(historyCreateSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: context.session.user }),
      );
    });

    test('should update trustee and create public contact history when public contact changes', async () => {
      const updatedBy = getCamsUserReference(context.session.user);
      const newPublicContact = MockData.getContactInformation();
      const updateData = { public: newPublicContact };
      const updatedTrustee = { ...existingTrustee, public: newPublicContact };

      const updateTrusteeSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      await trusteesUseCase.updateTrustee(context, trusteeId, updateData);
      expect(updateTrusteeSpy).toHaveBeenCalledWith(trusteeId, updatedTrustee, updatedBy);
      expect(updateTrusteeSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: context.session.user }),
      );
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_PUBLIC_CONTACT',
          trusteeId,
          before: existingTrustee.public,
          after: newPublicContact,
        }),
      );
    });

    test('should update trustee public contact with company name', async () => {
      const updatedBy = getCamsUserReference(context.session.user);
      const newPublicContact = {
        ...MockData.getContactInformation(),
        companyName: UPDATED_COMPANY_NAME,
      };
      const updateData = { public: newPublicContact };
      const updatedTrustee = { ...existingTrustee, public: newPublicContact };

      const updateTrusteeSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(updatedTrustee.public.companyName).toEqual(UPDATED_COMPANY_NAME);
      expect(updateTrusteeSpy).toHaveBeenCalledWith(trusteeId, updatedTrustee, updatedBy);
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_PUBLIC_CONTACT',
          trusteeId,
          before: existingTrustee.public,
          after: expect.objectContaining({
            companyName: UPDATED_COMPANY_NAME,
          }),
        }),
      );
    });

    test('should update trustee and create internal contact history when internal contact changes', async () => {
      const updatedBy = getCamsUserReference(context.session.user);
      const newInternalContact = MockData.getContactInformation();
      const updateData = { internal: newInternalContact };
      const updatedTrustee = { ...existingTrustee, internal: newInternalContact };

      const updateTrusteeSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      await trusteesUseCase.updateTrustee(context, trusteeId, updateData);
      expect(updateTrusteeSpy).toHaveBeenCalledWith(trusteeId, updatedTrustee, updatedBy);
      expect(updateTrusteeSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: context.session.user }),
      );
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_INTERNAL_CONTACT',
          trusteeId,
          before: existingTrustee.internal,
          after: newInternalContact,
        }),
      );
    });

    test('should update trustee and create banks history when banks change', async () => {
      const updatedBy = getCamsUserReference(context.session.user);
      const trusteeWithSoftware = MockData.getTrustee({
        softwareId: 'sw-axos',
        banks: ['bank-old'],
      });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(trusteeWithSoftware);
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
        id: 'sw-axos',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
        associatedBanks: [
          { bankId: 'bank-old', bankName: 'Old Bank', status: 'active' },
          { bankId: 'bank-a', bankName: 'Bank A', status: 'active' },
          { bankId: 'bank-b', bankName: 'Bank B', status: 'active' },
        ],
      });

      const newBanks = ['bank-a', 'bank-b'];
      const updateData = { banks: newBanks };
      const updatedTrustee = { ...trusteeWithSoftware, banks: newBanks };

      const updateTrusteeSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      await trusteesUseCase.updateTrustee(context, trusteeId, updateData);
      expect(updateTrusteeSpy).toHaveBeenCalledWith(trusteeId, updatedTrustee, updatedBy);
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_BANKS',
          trusteeId,
          before: ['Old Bank'],
          after: ['Bank A', 'Bank B'],
        }),
      );
    });

    test('should update trustee and create software history with resolved names when softwareId changes', async () => {
      const updatedBy = getCamsUserReference(context.session.user);
      const newSoftwareId = 'sw-new';
      const updateData = { softwareId: newSoftwareId };
      const updatedTrustee = { ...existingTrustee, softwareId: newSoftwareId };

      const updateTrusteeSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
        id: newSoftwareId,
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'New Software',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      });

      await trusteesUseCase.updateTrustee(context, trusteeId, updateData);
      expect(updateTrusteeSpy).toHaveBeenCalledWith(trusteeId, updatedTrustee, updatedBy);
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_SOFTWARE',
          trusteeId,
          before: undefined,
          after: 'New Software',
        }),
      );
    });

    test('should use raw softwareId as audit before-value when previous software is not found (404)', async () => {
      const oldSoftwareId = 'sw-old-gone';
      const newSoftwareId = 'sw-new';
      const trusteeWithOldSoftware = MockData.getTrustee({ softwareId: oldSoftwareId });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(trusteeWithOldSoftware);

      // loadAndValidateSoftware looks up newSoftwareId first, then resolveSoftwareName looks up oldSoftwareId
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById')
        .mockResolvedValueOnce({
          id: newSoftwareId,
          documentType: 'BANKRUPTCY_SOFTWARE',
          name: 'New Software',
          status: 'active',
          updatedOn: '2024-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'User One' },
        })
        .mockRejectedValueOnce(
          new NotFoundError('BANKRUPTCY-SOFTWARE-MONGO-REPOSITORY', {
            message: 'No matching item found.',
          }),
        );

      const updatedTrustee = { ...trusteeWithOldSoftware, softwareId: newSoftwareId };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      await trusteesUseCase.updateTrustee(context, trusteeId, { softwareId: newSoftwareId });

      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_SOFTWARE',
          before: oldSoftwareId,
          after: 'New Software',
        }),
      );
    });

    test('should propagate non-404 error from resolveSoftwareName', async () => {
      const oldSoftwareId = 'sw-old';
      const newSoftwareId = 'sw-new';
      const trusteeWithOldSoftware = MockData.getTrustee({ softwareId: oldSoftwareId });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(trusteeWithOldSoftware);

      const operationalError = new CamsError('BANKRUPTCY-SOFTWARE-MONGO-REPOSITORY', {
        status: 500,
        message: 'Internal database error.',
      });
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockRejectedValue(
        operationalError,
      );

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.updateTrustee(context, trusteeId, { softwareId: newSoftwareId }),
      );
      expect(actualError.isCamsError).toBe(true);
    });

    test('should resolve previous software name when softwareId changes and old software exists', async () => {
      const oldSoftwareId = 'sw-old';
      const newSoftwareId = 'sw-new';
      const trusteeWithOldSoftware = MockData.getTrustee({ softwareId: oldSoftwareId });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(trusteeWithOldSoftware);

      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById')
        .mockResolvedValueOnce({
          id: newSoftwareId,
          documentType: 'BANKRUPTCY_SOFTWARE',
          name: 'New Software',
          status: 'active',
          updatedOn: '2024-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'User One' },
        })
        .mockResolvedValueOnce({
          id: oldSoftwareId,
          documentType: 'BANKRUPTCY_SOFTWARE',
          name: 'Old Software',
          status: 'active',
          updatedOn: '2024-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'User One' },
        });

      const updatedTrustee = { ...trusteeWithOldSoftware, softwareId: newSoftwareId };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      await trusteesUseCase.updateTrustee(context, trusteeId, { softwareId: newSoftwareId });

      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_SOFTWARE',
          before: 'Old Software',
          after: 'New Software',
        }),
      );
    });

    test('should rethrow non-404 errors from resolveSoftwareName for old software', async () => {
      const oldSoftwareId = 'sw-old';
      const newSoftwareId = 'sw-new';
      const trusteeWithOldSoftware = MockData.getTrustee({ softwareId: oldSoftwareId });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(trusteeWithOldSoftware);

      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById')
        .mockResolvedValueOnce({
          id: newSoftwareId,
          documentType: 'BANKRUPTCY_SOFTWARE',
          name: 'New Software',
          status: 'active',
          updatedOn: '2024-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'User One' },
        })
        .mockRejectedValueOnce(
          new CamsError('BANKRUPTCY-SOFTWARE-MONGO-REPOSITORY', {
            status: 500,
            message: 'Connection timeout.',
          }),
        );

      const updatedTrustee = { ...trusteeWithOldSoftware, softwareId: newSoftwareId };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.updateTrustee(context, trusteeId, { softwareId: newSoftwareId }),
      );
      expect(actualError.isCamsError).toBe(true);
    });

    test('should throw BadRequestError when softwareId does not exist', async () => {
      const updateData = { softwareId: 'sw-nonexistent' };

      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockRejectedValue(
        new NotFoundError('BANKRUPTCY-SOFTWARE-MONGO-REPOSITORY', {
          message: 'No matching item found.',
        }),
      );

      await expect(trusteesUseCase.updateTrustee(context, trusteeId, updateData)).rejects.toThrow(
        BadRequestError,
      );
    });

    test('should let operational errors bubble up from validateSoftwareExists', async () => {
      const updateData = { softwareId: 'sw-123' };
      const operationalError = new CamsError('BANKRUPTCY-SOFTWARE-MONGO-REPOSITORY', {
        status: 500,
        message: 'Unable to retrieve bankruptcy software.',
      });

      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockRejectedValue(
        operationalError,
      );

      const thrownError = await getTheThrownError(() =>
        trusteesUseCase.updateTrustee(context, trusteeId, updateData),
      );
      expect(thrownError).not.toBeInstanceOf(BadRequestError);
      expect(thrownError.isCamsError).toBe(true);
    });

    test('should throw BadRequestError when banks are set without softwareId', async () => {
      const trusteeWithoutSoftware = MockData.getTrustee();
      delete trusteeWithoutSoftware.softwareId;
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(trusteeWithoutSoftware);

      const updateData = { banks: ['bank-1'] };

      await expect(trusteesUseCase.updateTrustee(context, trusteeId, updateData)).rejects.toThrow(
        BadRequestError,
      );
    });

    // bank-999 is not in sw-axos's associatedBanks, so loadAndValidateSoftware rejects it
    test('should throw BadRequestError when bank ID is not in software associatedBanks', async () => {
      const trusteeWithSoftware = MockData.getTrustee({ softwareId: 'sw-axos' });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(trusteeWithSoftware);
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
        id: 'sw-axos',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
        associatedBanks: [{ bankId: 'bank-1', bankName: 'Fifth Third', status: 'active' }],
      });

      const updateData = { banks: ['bank-999'] };

      await expect(trusteesUseCase.updateTrustee(context, trusteeId, updateData)).rejects.toThrow(
        BadRequestError,
      );
    });

    test('should allow banks that are in software associatedBanks', async () => {
      const trusteeWithSoftware = MockData.getTrustee({ softwareId: 'sw-axos' });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(trusteeWithSoftware);
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
        id: 'sw-axos',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
        associatedBanks: [
          { bankId: 'bank-1', bankName: 'Fifth Third', status: 'active' },
          { bankId: 'bank-2', bankName: 'Key Bank', status: 'active' },
        ],
      });

      const updateData = { banks: ['bank-1', 'bank-2'] };
      const updatedTrustee = { ...trusteeWithSoftware, banks: ['bank-1', 'bank-2'] };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, updateData);
      expect(result.banks).toEqual(['bank-1', 'bank-2']);
    });

    test('should resolve bank names in audit history when banks change', async () => {
      const trusteeWithSoftware = MockData.getTrustee({
        softwareId: 'sw-axos',
        banks: ['bank-1'],
      });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(trusteeWithSoftware);
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
        id: 'sw-axos',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
        associatedBanks: [
          { bankId: 'bank-1', bankName: 'Fifth Third', status: 'active' },
          { bankId: 'bank-2', bankName: 'Key Bank', status: 'active' },
        ],
      });

      const updateData = { banks: ['bank-1', 'bank-2'] };
      const updatedTrustee = { ...trusteeWithSoftware, banks: ['bank-1', 'bank-2'] };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_BANKS',
          trusteeId,
          before: ['Fifth Third'],
          after: ['Fifth Third', 'Key Bank'],
        }),
      );
    });

    test('should not create history when no fields change', async () => {
      const updateData = { name: existingTrustee.name };
      const updatedTrustee = { ...existingTrustee };

      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(result).toEqual(updatedTrustee);
      expect(historyCreateSpy).not.toHaveBeenCalled();
    });

    test('should throw BadRequestError for invalid update data', async () => {
      const invalidUpdateData = { firstName: '' };

      await expect(
        trusteesUseCase.updateTrustee(context, trusteeId, invalidUpdateData),
      ).rejects.toThrow(BadRequestError);
    });

    test('should ignore immutable fields in update data', async () => {
      const updateData = {
        name: 'Updated Name',
        trusteeId: 'should-be-ignored',
        id: 'should-be-ignored',
        createdBy: userRef,
        createdOn: new Date().toISOString(),
        updatedBy: userRef,
        updatedOn: new Date().toISOString(),
      };
      const updatedTrustee = { ...existingTrustee, name: 'Updated Name' };

      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(result).toEqual(updatedTrustee);
      expect(MockMongoRepository.prototype.updateTrustee).toHaveBeenCalledWith(
        trusteeId,
        expect.any(Object),
        userRef,
      );
    });

    test('should handle repository read error during update', async () => {
      const repositoryError = new Error('Trustee read failed');

      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.updateTrustee(context, trusteeId, {}),
      );
      expect(actualError.isCamsError).toBe(true);
    });

    test('should handle repository update error', async () => {
      const repositoryError = new Error('Update failed');

      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.updateTrustee(context, trusteeId, {}),
      );
      expect(actualError.isCamsError).toBe(true);
    });

    test('should remove fields when patch values are null, undefined, or an object with all null/undefined properties', async () => {
      const updateData = {
        name: 'Updated Name',
        internal: {
          address: null,
          email: null,
          phone: null,
        },
        softwareId: null,
        banks: undefined,
      };
      const updatedTrustee = { ...existingTrustee, name: 'Updated Name' };
      delete updatedTrustee.internal;
      delete updatedTrustee.softwareId;
      delete updatedTrustee.banks;

      const mongoMock = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(mongoMock).toHaveBeenCalledWith(
        trusteeId,
        expect.objectContaining({ name: 'Updated Name' }),
        expect.any(Object),
      );
      const patchedArg = (mongoMock.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
      expect(patchedArg).not.toHaveProperty('internal');
      expect(patchedArg).not.toHaveProperty('softwareId');
      expect(patchedArg).not.toHaveProperty('banks');
      expect(result).toEqual(updatedTrustee);
      expect(result.softwareId).toBeUndefined();
      expect(result.banks).toBeUndefined();
    });

    test('should remove fields in nested objects when patch values are null, undefined, or an object with all null/undefined properties', async () => {
      const updateData = {
        name: 'Updated Name',
        internal: {
          address: {
            address1: '1234 Test Ln',
            address2: null,
            address3: null,
            city: 'Washington',
            state: 'DC',
            zipCode: '11111',
            countryCode: 'US' as const,
          },
          email: null,
          phone: {
            number: null,
            extension: null,
          },
        },
      };
      const updatedTrustee = {
        ...existingTrustee,
        name: 'Updated Name',
        internal: {
          address: {
            address1: '1234 Test Ln',
            city: 'Washington',
            state: 'DC',
            zipCode: '11111',
            countryCode: 'US',
          },
          email: undefined,
          phone: undefined,
        },
      };

      const mongoMock = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(mongoMock).toHaveBeenCalledWith(
        trusteeId,
        expect.objectContaining(updatedTrustee),
        expect.any(Object),
      );
      expect(result).toEqual(updatedTrustee);
      expect(result.softwareId).toBeUndefined();
      expect(result.banks).toBeUndefined();
    });

    test('should handle empty internal contact object when updating from empty to populated', async () => {
      const existingTrusteeWithEmptyInternal = {
        ...existingTrustee,
        internal: {},
      };
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(
        existingTrusteeWithEmptyInternal,
      );

      const newInternalContact = MockData.getContactInformation();
      const updateData = { internal: newInternalContact };
      const updatedTrustee = { ...existingTrusteeWithEmptyInternal, internal: newInternalContact };

      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(result).toEqual(updatedTrustee);
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_INTERNAL_CONTACT',
          trusteeId,
          before: undefined,
          after: newInternalContact,
        }),
      );
    });

    test('should handle empty internal contact object when updating from populated to empty', async () => {
      const existingInternalContact = MockData.getContactInformation();
      const existingTrusteeWithInternal = {
        ...existingTrustee,
        internal: existingInternalContact,
      };
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(
        existingTrusteeWithInternal,
      );

      const updateData = { internal: {} };
      const updatedTrustee = { ...existingTrusteeWithInternal, internal: {} };

      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      const historyCreateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(result).toEqual(updatedTrustee);
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_INTERNAL_CONTACT',
          trusteeId,
          before: existingInternalContact,
          after: undefined,
        }),
      );
    });

    test('should succeed when clearing both softwareId and banks', async () => {
      const softwareId = 'sw-axos';
      const baseSoftwareProfile = {
        id: softwareId,
        documentType: 'BANKRUPTCY_SOFTWARE' as const,
        name: 'Axos',
        status: 'active' as const,
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      const trusteeWithSoftwareAndBanks = MockData.getTrustee({
        softwareId,
        banks: ['bank-active'],
      });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(
        trusteeWithSoftwareAndBanks,
      );
      // resolveSoftwareName is called for the old softwareId during audit history recording
      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
        ...baseSoftwareProfile,
        associatedBanks: [],
      });
      const updatedTrustee = { ...trusteeWithSoftwareAndBanks };
      delete updatedTrustee.softwareId;
      delete updatedTrustee.banks;
      const updateTrusteeSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, {
        softwareId: null,
        banks: null,
      });

      expect(updateTrusteeSpy).toHaveBeenCalled();
      expect(result.softwareId).toBeUndefined();
      expect(result.banks).toBeUndefined();
    });

    describe('bank status validation (CAMS-765)', () => {
      const softwareId = 'sw-axos';
      const baseSoftwareProfile = {
        id: softwareId,
        documentType: 'BANKRUPTCY_SOFTWARE' as const,
        name: 'Axos',
        status: 'active' as const,
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      const activeBanks = [
        { bankId: 'bank-active', bankName: 'Active Bank', status: 'active' as const },
        { bankId: 'bank-inactive', bankName: 'Inactive Bank', status: 'inactive' as const },
      ];

      let trusteeWithSoftware: ReturnType<typeof MockData.getTrustee>;

      beforeEach(() => {
        trusteeWithSoftware = MockData.getTrustee({ softwareId });
        vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(trusteeWithSoftware);
      });

      test('should throw BadRequestError and NOT call updateTrustee when bank status is inactive', async () => {
        vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
          ...baseSoftwareProfile,
          associatedBanks: activeBanks,
        });
        const updateTrusteeSpy = vi.spyOn(MockMongoRepository.prototype, 'updateTrustee');

        await expect(
          trusteesUseCase.updateTrustee(context, trusteeId, { banks: ['bank-inactive'] }),
        ).rejects.toThrow(BadRequestError);

        expect(updateTrusteeSpy).not.toHaveBeenCalled();
      });

      test('should throw BadRequestError when bank id is not in associatedBanks at all', async () => {
        vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
          ...baseSoftwareProfile,
          associatedBanks: [
            { bankId: 'bank-active', bankName: 'Active Bank', status: 'active' as const },
          ],
        });

        await expect(
          trusteesUseCase.updateTrustee(context, trusteeId, { banks: ['bank-unknown'] }),
        ).rejects.toThrow(BadRequestError);
      });

      test('should throw BadRequestError listing all invalid bank IDs when multiple are supplied', async () => {
        vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
          ...baseSoftwareProfile,
          associatedBanks: activeBanks,
        });

        const error = await trusteesUseCase
          .updateTrustee(context, trusteeId, {
            banks: ['bank-inactive', 'bank-unknown'],
          })
          .catch((e) => e);
        expect(error).toBeInstanceOf(BadRequestError);
        expect(error.message).toContain('bank-inactive');
        expect(error.message).toContain('bank-unknown');
      });

      test('should succeed and call updateTrustee when bank is active and associated', async () => {
        vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
          ...baseSoftwareProfile,
          associatedBanks: activeBanks,
        });
        const updatedTrustee = { ...trusteeWithSoftware, banks: ['bank-active'] };
        const updateTrusteeSpy = vi
          .spyOn(MockMongoRepository.prototype, 'updateTrustee')
          .mockResolvedValue(updatedTrustee);
        vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

        const result = await trusteesUseCase.updateTrustee(context, trusteeId, {
          banks: ['bank-active'],
        });

        expect(updateTrusteeSpy).toHaveBeenCalledWith(
          trusteeId,
          expect.objectContaining({ banks: ['bank-active'] }),
          expect.anything(),
        );
        expect(result.banks).toEqual(['bank-active']);
      });
    });

    describe('zoomInfoValidation', () => {
      test('should update trustee with valid zoomInfo', async () => {
        const updatedBy = getCamsUserReference(context.session.user);
        const newZoomInfo = {
          link: 'https://us02web.zoom.us/j/1234567890',
          phone: '123-456-7890',
          meetingId: '1234567890',
          passcode: MockData.randomAlphaNumeric(10),
        };
        const updateData = { zoomInfo: newZoomInfo };
        const updatedTrustee = { ...existingTrustee, zoomInfo: newZoomInfo };

        const updateTrusteeSpy = vi
          .spyOn(MockMongoRepository.prototype, 'updateTrustee')
          .mockResolvedValue(updatedTrustee);
        const historyCreateSpy = vi
          .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
          .mockResolvedValue();

        await trusteesUseCase.updateTrustee(context, trusteeId, updateData);
        expect(updateTrusteeSpy).toHaveBeenCalledWith(trusteeId, updatedTrustee, updatedBy);
        expect(historyCreateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            documentType: 'AUDIT_ZOOM_INFO',
            trusteeId,
            after: newZoomInfo,
          }),
        );
      });

      test('should throw BadRequestError for zoomInfo with invalid phone format', async () => {
        const invalidZoomInfo = {
          link: 'https://us02web.zoom.us/j/1234567890',
          phone: '12345',
          meetingId: '1234567890',
          passcode: MockData.randomAlphaNumeric(10),
        };
        const updateData = { zoomInfo: invalidZoomInfo };

        const error = await getTheThrownError(() =>
          trusteesUseCase.updateTrustee(context, trusteeId, updateData),
        );
        expect(error.isCamsError).toBe(true);
        expect(error.message).toContain(FIELD_VALIDATION_MESSAGES.PHONE_NUMBER);
      });

      test('should throw BadRequestError for zoomInfo with invalid link', async () => {
        const invalidZoomInfo = {
          link: 'not-a-valid-url',
          phone: '123-456-7890',
          meetingId: '1234567890',
          passcode: MockData.randomAlphaNumeric(10),
        };
        const updateData = { zoomInfo: invalidZoomInfo };

        const error = await getTheThrownError(() =>
          trusteesUseCase.updateTrustee(context, trusteeId, updateData),
        );
        expect(error.isCamsError).toBe(true);
        expect(error.message).toContain(FIELD_VALIDATION_MESSAGES.ZOOM_LINK);
      });

      test.each([
        ['too short', '12345678'],
        ['too long', '123456789012'],
        ['non-numeric', 'INVALID'],
      ])(
        'should throw BadRequestError for zoomInfo with invalid meeting ID (%s)',
        async (_label, meetingId) => {
          const invalidZoomInfo = {
            link: 'https://us02web.zoom.us/j/1234567890',
            phone: '123-456-7890',
            meetingId,
            passcode: MockData.randomAlphaNumeric(10),
          };
          const updateData = { zoomInfo: invalidZoomInfo };

          const error = await getTheThrownError(() =>
            trusteesUseCase.updateTrustee(context, trusteeId, updateData),
          );
          expect(error.isCamsError).toBe(true);
          expect(error.message).toContain(FIELD_VALIDATION_MESSAGES.ZOOM_MEETING_ID);
        },
      );

      test('should throw BadRequestError for zoomInfo with link exceeding max length', async () => {
        const invalidZoomInfo = {
          link: 'https://us02web.zoom.us/j/' + 'a'.repeat(300),
          phone: '123-456-7890',
          meetingId: '1234567890',
          passcode: MockData.randomAlphaNumeric(10),
        };
        const updateData = { zoomInfo: invalidZoomInfo };

        const error = await getTheThrownError(() =>
          trusteesUseCase.updateTrustee(context, trusteeId, updateData),
        );
        expect(error.isCamsError).toBe(true);
        expect(error.message).toContain(FIELD_VALIDATION_MESSAGES.ZOOM_LINK_MAX_LENGTH);
      });

      test('should throw BadRequestError for zoomInfo with empty required fields', async () => {
        const invalidZoomInfo = {
          link: '',
          phone: '123-456-7890',
          meetingId: '1234567890',
          passcode: MockData.randomAlphaNumeric(10),
        };
        const updateData = { zoomInfo: invalidZoomInfo };

        await expect(trusteesUseCase.updateTrustee(context, trusteeId, updateData)).rejects.toThrow(
          BadRequestError,
        );
      });
    });
  });

  describe('change set emission', () => {
    let updateTrusteeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      vi.restoreAllMocks();
      context = await createMockApplicationContext();
      trusteesUseCase = new TrusteesUseCase(context);
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();
      updateTrusteeSpy = vi.spyOn(MockMongoRepository.prototype, 'updateTrustee');
    });

    async function captureChangeSet(
      before: ReturnType<typeof MockData.getTrustee>,
      after: ReturnType<typeof MockData.getTrustee>,
      diff: Parameters<TrusteesUseCase['updateTrustee']>[2],
    ) {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(before);
      updateTrusteeSpy.mockResolvedValue(after);

      const recordSpy = vi.spyOn(
        trusteesUseCase as unknown as {
          recordAuditHistory: TrusteesUseCase['updateTrustee'];
        },
        'recordAuditHistory',
      );

      await trusteesUseCase.updateTrustee(context, before.trusteeId, diff);

      const result = await recordSpy.mock.results[0].value;
      return result;
    }

    test('returns an empty fields array when no fields differ', async () => {
      const before = MockData.getTrustee();
      const changeSet = await captureChangeSet(before, before, { name: before.name });

      expect(changeSet.fields).toEqual([]);
      expect(changeSet.trusteeId).toBe(before.trusteeId);
      expect(changeSet.trusteeName).toBe(before.name);
    });

    test('emits a single Name field for a name-only change', async () => {
      const before = MockData.getTrustee({ name: 'Henry Green' });
      const after = { ...before, name: 'Henry G. Green' };

      const changeSet = await captureChangeSet(before, after, { name: 'Henry G. Green' });

      expect(changeSet.fields).toHaveLength(1);
      expect(changeSet.fields[0]).toMatchObject({
        label: 'Name',
        before: 'Henry Green',
        after: 'Henry G. Green',
        category: 'profile',
        section: 'appointment',
      });
    });

    test('emits multiple fields for a multi-field profile change', async () => {
      const before = MockData.getTrustee();
      const newPublic = MockData.getContactInformation();
      const after = { ...before, name: 'Renamed', public: newPublic };

      const changeSet = await captureChangeSet(before, after, {
        name: 'Renamed',
        public: newPublic,
      });

      const labels = changeSet.fields.map((f) => f.label);
      expect(labels).toContain('Name');
      expect(labels).toContain('Public Contact');
    });

    test('zoom info changes emit a meeting-section field with zoom-341 category', async () => {
      const before = MockData.getTrustee({
        zoomInfo: {
          link: 'https://zoom.us/j/1234567890',
          phone: '555-555-0000',
          meetingId: '123456789',
          passcode: 'oldpass',
        },
      });
      const newZoom = {
        link: 'https://zoom.us/j/9876543210',
        phone: '555-555-1111',
        meetingId: '987654321',
        passcode: 'newpass',
      };
      const after = { ...before, zoomInfo: newZoom };

      const changeSet = await captureChangeSet(before, after, { zoomInfo: newZoom });

      const zoomField = changeSet.fields.find((f) => f.label === 'Zoom Info');
      expect(zoomField).toBeDefined();
      expect(zoomField?.category).toBe('zoom-341');
      expect(zoomField?.section).toBe('meeting');
      expect(zoomField?.before).toContain('https://zoom.us/j/1234567890');
      expect(zoomField?.after).toContain('https://zoom.us/j/9876543210');
    });

    test('zoom info field includes accountEmail when present', async () => {
      const before = MockData.getTrustee({
        zoomInfo: {
          link: 'https://zoom.us/j/1234567890',
          phone: '555-555-0000',
          meetingId: '123456789',
          passcode: 'oldpass',
          accountEmail: 'old@zoom.test',
        },
      });
      const newZoom = {
        link: 'https://zoom.us/j/9876543210',
        phone: '555-555-1111',
        meetingId: '987654321',
        passcode: 'newpass',
        accountEmail: 'new@zoom.test',
      };
      const after = { ...before, zoomInfo: newZoom };

      const changeSet = await captureChangeSet(before, after, { zoomInfo: newZoom });

      const zoomField = changeSet.fields.find((f) => f.label === 'Zoom Info');
      expect(zoomField?.before).toContain('old@zoom.test');
      expect(zoomField?.after).toContain('new@zoom.test');
    });

    test('zoom info formats gracefully when before has only a link', async () => {
      const before = MockData.getTrustee({
        zoomInfo: {
          link: 'https://zoom.us/j/1234567890',
          phone: '',
          meetingId: '',
          passcode: '',
        },
      });
      const newZoom = {
        link: 'https://zoom.us/j/9876543210',
        phone: '555-555-1111',
        meetingId: '987654321',
        passcode: 'newpass',
      };
      const after = { ...before, zoomInfo: newZoom };

      const changeSet = await captureChangeSet(before, after, { zoomInfo: newZoom });

      const zoomField = changeSet.fields.find((f) => f.label === 'Zoom Info');
      expect(zoomField).toBeDefined();
      expect(zoomField?.before).toContain('link:');
      expect(zoomField?.before).not.toContain('phone:');
      expect(zoomField?.before).not.toContain('meetingId:');
      expect(zoomField?.before).not.toContain('passcode:');
    });

    test('zoom info formats gracefully when before has no link', async () => {
      const before = MockData.getTrustee({
        zoomInfo: {
          link: '',
          phone: '555-555-0000',
          meetingId: '123456789',
          passcode: 'pass',
        },
      });
      const newZoom = {
        link: 'https://zoom.us/j/9876543210',
        phone: '555-555-1111',
        meetingId: '987654321',
        passcode: 'newpass',
      };
      const after = { ...before, zoomInfo: newZoom };

      const changeSet = await captureChangeSet(before, after, { zoomInfo: newZoom });

      const zoomField = changeSet.fields.find((f) => f.label === 'Zoom Info');
      expect(zoomField).toBeDefined();
      expect(zoomField?.before).not.toContain('link:');
      expect(zoomField?.before).toContain('phone:');
    });

    test('public contact change formats contact without address field', async () => {
      const publicWithoutAddress = {
        phone: { number: '555-111-0000' },
        email: 'old@example.test',
      } as unknown as ContactInformation;
      const newPublic = MockData.getContactInformation();
      const before = MockData.getTrustee({ public: publicWithoutAddress });
      const after = { ...before, public: newPublic };

      const changeSet = await captureChangeSet(before, after, { public: newPublic });

      const contactField = changeSet.fields.find(
        (f: { label: string }) => f.label === 'Public Contact',
      );
      expect(contactField).toBeDefined();
      expect(contactField?.before).not.toContain('address:');
    });

    test('software removal emits empty after value in change set', async () => {
      const oldSoftwareId = 'sw-old';
      const trusteeWithSoftware = MockData.getTrustee({ softwareId: oldSoftwareId });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(trusteeWithSoftware);

      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
        id: oldSoftwareId,
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Old Software',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      });

      const updatedTrustee = { ...trusteeWithSoftware, softwareId: undefined };
      updateTrusteeSpy.mockResolvedValue(updatedTrustee);

      const recordSpy = vi.spyOn(
        trusteesUseCase as unknown as {
          recordAuditHistory: TrusteesUseCase['updateTrustee'];
        },
        'recordAuditHistory',
      );

      await trusteesUseCase.updateTrustee(context, trusteeWithSoftware.trusteeId, {
        softwareId: null,
      });

      const changeSet = await recordSpy.mock.results[0].value;
      const softwareField = changeSet.fields.find((f: { label: string }) => f.label === 'Software');
      expect(softwareField).toBeDefined();
      expect(softwareField?.before).toBe('Old Software');
      expect(softwareField?.after).toBe('');
    });

    test('removing all banks emits empty after value', async () => {
      const before = MockData.getTrustee({ softwareId: 'sw-1', banks: ['bank-old'] });
      const after = { ...before, banks: undefined };

      const changeSet = await captureChangeSet(before, after, { banks: null });

      const banksField = changeSet.fields.find((f: { label: string }) => f.label === 'Banks');
      expect(banksField).toBeDefined();
      expect(banksField?.before).toBe('bank-old');
      expect(banksField?.after).toBe('');
    });

    test('banks change falls back to raw IDs when bank is not in associatedBanks map', async () => {
      const before = MockData.getTrustee({ softwareId: 'sw-1', banks: ['bank-old'] });
      const after = { ...before, banks: ['bank-new'] };

      vi.spyOn(MockMongoRepository.prototype, 'findSoftwareById').mockResolvedValue({
        id: 'sw-1',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'TestSoft',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
        associatedBanks: [
          { bankId: 'bank-old', bankName: 'Old Bank', status: 'active' },
          { bankId: 'bank-new', bankName: 'New Bank', status: 'active' },
        ],
      });

      const changeSet = await captureChangeSet(before, after, { banks: ['bank-new'] });

      const banksField = changeSet.fields.find((f: { label: string }) => f.label === 'Banks');
      expect(banksField).toBeDefined();
      expect(banksField?.before).toBe('Old Bank');
      expect(banksField?.after).toBe('New Bank');
    });

    test('contact address with empty sub-fields does not emit an address line', async () => {
      const publicWithEmptyAddress = {
        phone: { number: '555-111-0000' },
        email: 'old@example.test',
        address: { address1: '', city: '', state: '', zipCode: '', countryCode: '' },
      } as unknown as ContactInformation;
      const newPublic = MockData.getContactInformation();
      const before = MockData.getTrustee({ public: publicWithEmptyAddress });
      const after = { ...before, public: newPublic };

      const changeSet = await captureChangeSet(before, after, { public: newPublic });

      const contactField = changeSet.fields.find(
        (f: { label: string }) => f.label === 'Public Contact',
      );
      expect(contactField).toBeDefined();
      expect(contactField?.before).not.toContain('address:');
    });
  });

  describe('resolvePrimaryChapter', () => {
    beforeEach(async () => {
      vi.restoreAllMocks();
      context = await createMockApplicationContext();
      trusteesUseCase = new TrusteesUseCase(context);
    });

    function callResolvePrimaryChapter(trusteeId: string) {
      return (
        trusteesUseCase as unknown as {
          resolvePrimaryChapter: (id: string) => Promise<AppointmentChapterType | undefined>;
        }
      ).resolvePrimaryChapter(trusteeId);
    }

    test('returns undefined when the trustee has no appointments', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([]);

      const chapter = await callResolvePrimaryChapter('trustee-1');

      expect(chapter).toBeUndefined();
    });

    test('returns the chapter of the only active appointment', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        MockData.getTrusteeAppointment({
          chapter: '7',
          status: 'active',
          appointedDate: '2020-01-15',
        }),
      ]);

      const chapter = await callResolvePrimaryChapter('trustee-1');

      expect(chapter).toBe('7');
    });

    test('prefers an active appointment over a more recent inactive one', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        MockData.getTrusteeAppointment({
          chapter: '13',
          status: 'inactive',
          appointedDate: '2024-01-01',
        }),
        MockData.getTrusteeAppointment({
          chapter: '7',
          status: 'active',
          appointedDate: '2020-01-15',
        }),
      ]);

      const chapter = await callResolvePrimaryChapter('trustee-1');

      expect(chapter).toBe('7');
    });

    test('falls back to the most recent overall when no active appointment exists', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        MockData.getTrusteeAppointment({
          chapter: '13',
          status: 'inactive',
          appointedDate: '2020-01-01',
        }),
        MockData.getTrusteeAppointment({
          chapter: '11',
          status: 'inactive',
          appointedDate: '2024-06-01',
        }),
      ]);

      const chapter = await callResolvePrimaryChapter('trustee-1');

      expect(chapter).toBe('11');
    });

    test('among multiple active appointments returns the most recently appointed', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        MockData.getTrusteeAppointment({
          chapter: '7',
          status: 'active',
          appointedDate: '2020-01-15',
        }),
        MockData.getTrusteeAppointment({
          chapter: '11',
          status: 'active',
          appointedDate: '2024-06-01',
        }),
      ]);

      const chapter = await callResolvePrimaryChapter('trustee-1');

      expect(chapter).toBe('11');
    });
  });

  describe('updateTrustee notification dispatch (CAMS-768 Slice 1)', () => {
    const trusteeId = 'trustee-notify-1';
    let existingTrustee: ReturnType<typeof MockData.getTrustee>;

    beforeEach(async () => {
      vi.restoreAllMocks();
      context = await createMockApplicationContext();
      context.featureFlags['trustee-change-notification-enabled'] = true;
      trusteesUseCase = new TrusteesUseCase(context);
      MockNotificationGateway.getInstance().clear();

      existingTrustee = MockData.getTrustee({ trusteeId, name: 'Henry Green' });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

      vi.spyOn(MockMongoRepository.prototype, 'findRecipientByRoutingKey').mockImplementation(
        async (key: string) => {
          if (key === 'chapter:7') {
            return {
              covers: ['chapter:7', 'chapter:11', 'chapter:12', 'chapter:13'],
              recipientAddress: 'ch7-oversight@example.test',
              displayName: 'Default Chapter Oversight',
            };
          }
          return null;
        },
      );

      // Provide a CH7 active appointment so resolvePrimaryChapter resolves.
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        MockData.getTrusteeAppointment({
          trusteeId,
          chapter: '7',
          status: 'active',
          appointedDate: '2020-01-15',
        }),
      ]);
    });

    test('does not dispatch when feature flag is disabled', async () => {
      context.featureFlags['trustee-change-notification-enabled'] = false;

      const updatedTrustee = { ...existingTrustee, name: 'Henry G. Green' };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);

      await trusteesUseCase.updateTrustee(context, trusteeId, { name: 'Henry G. Green' });

      expect(MockNotificationGateway.getInstance().getRecorded()).toHaveLength(0);
    });

    test('dispatches one notification to the chapter:7 recipient on a profile-only change', async () => {
      const updatedTrustee = { ...existingTrustee, name: 'Henry G. Green' };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);

      await trusteesUseCase.updateTrustee(context, trusteeId, { name: 'Henry G. Green' });

      const recorded = MockNotificationGateway.getInstance().getRecorded();
      expect(recorded).toHaveLength(1);
      expect(recorded[0].to).toBe('ch7-oversight@example.test');
      expect(recorded[0].subject).toBe('Trustee Information Changed: Henry G. Green');
    });

    test('does not dispatch when the change set is empty', async () => {
      // Update with the existing name -> no fields differ.
      const updatedTrustee = { ...existingTrustee };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);

      await trusteesUseCase.updateTrustee(context, trusteeId, { name: existingTrustee.name });

      expect(MockNotificationGateway.getInstance().getRecorded()).toEqual([]);
    });

    test('returns the updated trustee successfully when the gateway throws', async () => {
      const updatedTrustee = { ...existingTrustee, name: 'Henry G. Green' };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);

      // Force the gateway to throw on send.
      vi.spyOn(MockNotificationGateway.prototype, 'send').mockRejectedValue(
        new Error('Simulated provider failure'),
      );
      const errorSpy = vi.spyOn(context.logger, 'error');

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, {
        name: 'Henry G. Green',
      });

      expect(result).toEqual(updatedTrustee);
      expect(errorSpy).toHaveBeenCalledWith(
        MODULE_NAME,
        'Failed to dispatch trustee change notification.',
        expect.any(Error),
      );
    });

    test('multi-field save produces one notification whose body contains every changed label', async () => {
      const newPublic = MockData.getContactInformation();
      const updatedTrustee = {
        ...existingTrustee,
        name: 'Henry G. Green',
        public: newPublic,
      };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);

      await trusteesUseCase.updateTrustee(context, trusteeId, {
        name: 'Henry G. Green',
        public: newPublic,
      });

      const recorded = MockNotificationGateway.getInstance().getRecorded();
      expect(recorded).toHaveLength(1);
      expect(recorded[0].html).toContain('Name');
      expect(recorded[0].html).toContain('Public Contact');
    });

    test('notification body includes author name and email from session user', async () => {
      context.session.user = {
        ...context.session.user,
        name: 'Alex Rivera',
        email: 'alex@ustp.test',
      };

      const updatedTrustee = { ...existingTrustee, name: 'Henry G. Green' };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);

      await trusteesUseCase.updateTrustee(context, trusteeId, { name: 'Henry G. Green' });

      const recorded = MockNotificationGateway.getInstance().getRecorded();
      expect(recorded).toHaveLength(1);
      expect(recorded[0].html).toContain('Alex Rivera');
      expect(recorded[0].html).toContain('alex@ustp.test');
    });

    test('notification body includes profile link when CAMS_FRONTEND_URL is set', async () => {
      process.env.CAMS_FRONTEND_URL = 'https://cams.ustp.gov';

      const updatedTrustee = { ...existingTrustee, name: 'Henry G. Green' };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);

      await trusteesUseCase.updateTrustee(context, trusteeId, { name: 'Henry G. Green' });

      const recorded = MockNotificationGateway.getInstance().getRecorded();
      expect(recorded).toHaveLength(1);
      expect(recorded[0].html).toContain(`https://cams.ustp.gov/trustees/${trusteeId}`);

      delete process.env.CAMS_FRONTEND_URL;
    });

    test('notification body omits profile link when CAMS_FRONTEND_URL is not set', async () => {
      delete process.env.CAMS_FRONTEND_URL;

      const updatedTrustee = { ...existingTrustee, name: 'Henry G. Green' };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);

      await trusteesUseCase.updateTrustee(context, trusteeId, { name: 'Henry G. Green' });

      const recorded = MockNotificationGateway.getInstance().getRecorded();
      expect(recorded).toHaveLength(1);
      expect(recorded[0].html).not.toContain('View Trustee Profile');
    });

    test('does not dispatch notification when suppressNotifications is true', async () => {
      const updatedTrustee = { ...existingTrustee, name: 'Henry G. Green' };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);

      const result = await trusteesUseCase.updateTrustee(
        context,
        trusteeId,
        { name: 'Henry G. Green' },
        { suppressNotifications: true },
      );

      expect(result).toEqual(updatedTrustee);
      expect(MockNotificationGateway.getInstance().getRecorded()).toHaveLength(0);
    });

    test('still writes audit history when suppressNotifications is true', async () => {
      const updatedTrustee = { ...existingTrustee, name: 'Henry G. Green' };
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      const historySpy = vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory');

      await trusteesUseCase.updateTrustee(
        context,
        trusteeId,
        { name: 'Henry G. Green' },
        { suppressNotifications: true },
      );

      expect(historySpy).toHaveBeenCalled();
    });
  });
});
