import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import BackfillTrusteeContactPhonesUseCase from './backfill-trustee-contact-phones';
import factory from '../../factory';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { Trustee, TrusteeContact } from '@common/cams/trustees';
import { TrusteeStaff } from '@common/cams/trustee-staff';

describe('BackfillTrusteeContactPhonesUseCase', () => {
  let context: ApplicationContext;

  const makeTrustee = (
    internal?: TrusteeContact & { phone?: { number: string; extension?: string } },
  ): Trustee =>
    ({
      id: 'doc-trustee-001',
      trusteeId: 'trustee-001',
      name: 'John Doe',
      public: {
        address: {
          address1: '1 Main St',
          city: 'Anytown',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
      internal,
      documentType: 'TRUSTEE',
    }) as unknown as Trustee;

  const makeStaff = (contact?: {
    phone?: { number: string; extension?: string };
    phones?: unknown[];
  }): TrusteeStaff =>
    ({
      id: 'staff-001',
      trusteeId: 'trustee-001',
      name: 'Jane Staff',
      documentType: 'TRUSTEE_STAFF',
      contact,
      createdOn: '2025-01-01T00:00:00Z',
      createdBy: { id: 'user-1', name: 'User One' },
      updatedOn: '2025-01-01T00:00:00Z',
      updatedBy: { id: 'user-1', name: 'User One' },
    }) as unknown as TrusteeStaff;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('backfillTrusteeContactPhones', () => {
    test('migrates trustees with legacy internal.phone to phones array', async () => {
      const updateTrusteeSpy = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listTrustees: vi.fn().mockResolvedValue([
            makeTrustee({ phone: { number: '555-111-2222' } } as TrusteeContact & {
              phone: { number: string };
            }),
          ]),
          updateTrustee: updateTrusteeSpy,
        }),
      );
      vi.spyOn(factory, 'getTrusteeStaffRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listUnmigratedStaff: vi.fn().mockResolvedValue([]),
          updateStaffMember: vi.fn(),
        }),
      );

      const result =
        await BackfillTrusteeContactPhonesUseCase.backfillTrusteeContactPhones(context);

      expect(result.data?.internalMigrated).toBe(1);
      expect(result.data?.internalSkipped).toBe(0);
      expect(result.data?.internalFailed).toBe(0);
      expect(updateTrusteeSpy).toHaveBeenCalledTimes(1);
      const updatedTrustee = updateTrusteeSpy.mock.calls[0][1] as Trustee;
      expect(updatedTrustee.internal?.phones).toEqual([{ number: '555-111-2222', type: 'direct' }]);
    });

    test('migrates trustees with extension', async () => {
      const updateTrusteeSpy = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listTrustees: vi.fn().mockResolvedValue([
            makeTrustee({
              phone: { number: '555-111-2222', extension: '42' },
            } as TrusteeContact & { phone: { number: string; extension: string } }),
          ]),
          updateTrustee: updateTrusteeSpy,
        }),
      );
      vi.spyOn(factory, 'getTrusteeStaffRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listUnmigratedStaff: vi.fn().mockResolvedValue([]),
          updateStaffMember: vi.fn(),
        }),
      );

      await BackfillTrusteeContactPhonesUseCase.backfillTrusteeContactPhones(context);

      const updatedTrustee = updateTrusteeSpy.mock.calls[0][1] as Trustee;
      expect(updatedTrustee.internal?.phones).toEqual([
        { number: '555-111-2222', type: 'direct', extension: '42' },
      ]);
    });

    test('skips trustees already migrated (phones exists)', async () => {
      const updateTrusteeSpy = vi.fn();
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listTrustees: vi.fn().mockResolvedValue([
            makeTrustee({
              phones: [{ number: '555-111-2222', type: 'direct' }],
            } as TrusteeContact),
          ]),
          updateTrustee: updateTrusteeSpy,
        }),
      );
      vi.spyOn(factory, 'getTrusteeStaffRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listUnmigratedStaff: vi.fn().mockResolvedValue([]),
          updateStaffMember: vi.fn(),
        }),
      );

      const result =
        await BackfillTrusteeContactPhonesUseCase.backfillTrusteeContactPhones(context);

      expect(result.data?.internalSkipped).toBe(1);
      expect(result.data?.internalMigrated).toBe(0);
      expect(updateTrusteeSpy).not.toHaveBeenCalled();
    });

    test('skips trustees with no internal contact', async () => {
      const updateTrusteeSpy = vi.fn();
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listTrustees: vi.fn().mockResolvedValue([makeTrustee(undefined)]),
          updateTrustee: updateTrusteeSpy,
        }),
      );
      vi.spyOn(factory, 'getTrusteeStaffRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listUnmigratedStaff: vi.fn().mockResolvedValue([]),
          updateStaffMember: vi.fn(),
        }),
      );

      const result =
        await BackfillTrusteeContactPhonesUseCase.backfillTrusteeContactPhones(context);

      expect(result.data?.internalSkipped).toBe(1);
      expect(updateTrusteeSpy).not.toHaveBeenCalled();
    });

    test('records failed count when internal update throws', async () => {
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listTrustees: vi.fn().mockResolvedValue([
            makeTrustee({ phone: { number: '555-111-2222' } } as TrusteeContact & {
              phone: { number: string };
            }),
          ]),
          updateTrustee: vi.fn().mockRejectedValue(new Error('DB error')),
        }),
      );
      vi.spyOn(factory, 'getTrusteeStaffRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listUnmigratedStaff: vi.fn().mockResolvedValue([]),
          updateStaffMember: vi.fn(),
        }),
      );

      const result =
        await BackfillTrusteeContactPhonesUseCase.backfillTrusteeContactPhones(context);

      expect(result.data?.internalFailed).toBe(1);
      expect(result.data?.internalMigrated).toBe(0);
    });

    test('migrates staff with legacy contact.phone to phones array', async () => {
      const updateStaffSpy = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listTrustees: vi.fn().mockResolvedValue([]),
          updateTrustee: vi.fn(),
        }),
      );
      vi.spyOn(factory, 'getTrusteeStaffRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listUnmigratedStaff: vi
            .fn()
            .mockResolvedValue([makeStaff({ phone: { number: '555-333-4444' } })]),
          updateStaffMember: updateStaffSpy,
        }),
      );

      const result =
        await BackfillTrusteeContactPhonesUseCase.backfillTrusteeContactPhones(context);

      expect(result.data?.staffMigrated).toBe(1);
      expect(result.data?.staffFailed).toBe(0);
      const input = updateStaffSpy.mock.calls[0][2];
      expect(input.contact.phones).toEqual([{ number: '555-333-4444', type: 'direct' }]);
    });

    test('records failed count when staff update throws', async () => {
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listTrustees: vi.fn().mockResolvedValue([]),
          updateTrustee: vi.fn(),
        }),
      );
      vi.spyOn(factory, 'getTrusteeStaffRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listUnmigratedStaff: vi
            .fn()
            .mockResolvedValue([makeStaff({ phone: { number: '555-333-4444' } })]),
          updateStaffMember: vi.fn().mockRejectedValue(new Error('Staff DB error')),
        }),
      );

      const result =
        await BackfillTrusteeContactPhonesUseCase.backfillTrusteeContactPhones(context);

      expect(result.data?.staffFailed).toBe(1);
      expect(result.data?.staffMigrated).toBe(0);
    });

    test('returns error when listTrustees throws', async () => {
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listTrustees: vi.fn().mockRejectedValue(new Error('Connection failed')),
          updateTrustee: vi.fn(),
        }),
      );
      vi.spyOn(factory, 'getTrusteeStaffRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          listUnmigratedStaff: vi.fn().mockResolvedValue([]),
          updateStaffMember: vi.fn(),
        }),
      );

      const result =
        await BackfillTrusteeContactPhonesUseCase.backfillTrusteeContactPhones(context);

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });
});
