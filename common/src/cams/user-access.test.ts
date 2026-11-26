import { describe, test, expect } from 'vitest';
import { CamsRole, CamsRoles } from './roles';
import { validateObject, VALID } from './validation';
import {
  activeKeyFor,
  inactiveKeyFor,
  isUnscopedRole,
  scopeLabel,
  scopesOverlap,
  RoleAssignmentAuditEntry,
  RoleAssignmentGrantRequest,
  roleAssignmentGrantRequestSpec,
  toPermissionChange,
  UserRoleAssignment,
} from './user-access';

const MANHATTAN = 'USTP_CAMS_Region_2_Office_Manhattan';
const BUFFALO = 'USTP_CAMS_Region_2_Office_Buffalo';

// Each source of a scope gets a different one, so a test fails if a row reads the wrong one:
// auditEntry's top-level fields are Manhattan and its newState is Buffalo.
function auditEntry(overrides: Partial<RoleAssignmentAuditEntry> = {}): RoleAssignmentAuditEntry {
  return {
    documentType: 'ROLE_ASSIGNMENT_AUDIT',
    id: 'audit-1',
    assignmentId: 'assignment-1',
    action: 'CREATED',
    userId: 'user-1',
    userName: 'Sarah Williams',
    role: CamsRole.TrialAttorney,
    regionId: '02',
    officeCode: MANHATTAN,
    performedBy: 'super-1',
    performedByName: 'Maria Garcia',
    performedAt: '2026-11-20T15:00:00.000Z',
    previousState: null,
    newState: { role: CamsRole.TrialAttorney, regionId: '02', officeCode: BUFFALO, active: true },
    replacedByAssignmentId: null,
    ...overrides,
  };
}

/**
 * A DEACTIVATED record by a different Super User than auditEntry's grant. Its previousState is
 * Region 2 - All Offices, distinct from the top-level and newState scopes.
 */
function deactivation(overrides: Partial<RoleAssignmentAuditEntry> = {}): RoleAssignmentAuditEntry {
  return auditEntry({
    id: 'audit-2',
    action: 'DEACTIVATED',
    performedBy: 'super-2',
    performedByName: 'Lisa Okafor',
    performedAt: '2026-11-25T16:30:00.000Z',
    previousState: { role: CamsRole.TrialAttorney, regionId: '02', officeCode: null, active: true },
    newState: { role: CamsRole.TrialAttorney, regionId: '02', officeCode: BUFFALO, active: false },
    ...overrides,
  });
}

/** The fields every row copies from its audit record, for a record built by deactivation(). */
const DEACTIVATION_ROW_FIELDS = {
  auditId: 'audit-2',
  assignmentId: 'assignment-1',
  userId: 'user-1',
  userName: 'Sarah Williams',
  performedBy: 'super-2',
  performedByName: 'Lisa Okafor',
  performedAt: '2026-11-25T16:30:00.000Z',
};

describe('user-access', () => {
  describe('activeKeyFor', () => {
    test.each([
      {
        scope: 'one office',
        regionId: '02',
        officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
        expected: 'TrialAttorney|02|USTP_CAMS_Region_2_Office_Manhattan',
      },
      { scope: 'a whole region', regionId: '02', officeCode: null, expected: 'TrialAttorney|02|*' },
      { scope: 'national', regionId: null, officeCode: null, expected: 'TrialAttorney|*|*' },
    ])('should build the key for $scope', ({ regionId, officeCode, expected }) => {
      expect(activeKeyFor(CamsRole.TrialAttorney, regionId, officeCode)).toEqual(expected);
    });
  });

  describe('inactiveKeyFor', () => {
    test('should build a key unique to the deactivated assignment', () => {
      expect(inactiveKeyFor('assignment-1')).toEqual('inactive|assignment-1');
    });
  });

  describe('roleAssignmentGrantRequestSpec', () => {
    const validRequest: RoleAssignmentGrantRequest = {
      userId: 'user-1',
      role: CamsRole.TrialAttorney,
      regionId: '2',
      officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
    };

    test('should accept a complete request', () => {
      expect(validateObject(roleAssignmentGrantRequestSpec, validRequest)).toEqual(VALID);
    });

    test.each(CamsRoles)('should accept the role %s', (role) => {
      const request = { ...validRequest, role };
      expect(validateObject(roleAssignmentGrantRequestSpec, request)).toEqual(VALID);
    });

    const USER_REQUIRED = 'A user is required';
    const ROLE_REQUIRED = 'A valid role is required';
    const REGION_REQUIRED = 'A region is required';
    const OFFICE_REQUIRED = 'An office is required';

    test.each([
      { case: 'an empty userId', field: 'userId', value: '', expected: USER_REQUIRED },
      { case: 'a blank userId', field: 'userId', value: '   ', expected: USER_REQUIRED },
      { case: 'a missing userId', field: 'userId', value: undefined, expected: USER_REQUIRED },
      { case: 'a null userId', field: 'userId', value: null, expected: USER_REQUIRED },
      { case: 'an array userId', field: 'userId', value: ['user-1'], expected: USER_REQUIRED },
      { case: 'an empty regionId', field: 'regionId', value: '', expected: REGION_REQUIRED },
      { case: 'a blank regionId', field: 'regionId', value: '  ', expected: REGION_REQUIRED },
      {
        case: 'a missing regionId',
        field: 'regionId',
        value: undefined,
        expected: REGION_REQUIRED,
      },
      { case: 'an empty officeCode', field: 'officeCode', value: '', expected: OFFICE_REQUIRED },
      { case: 'a blank officeCode', field: 'officeCode', value: '  ', expected: OFFICE_REQUIRED },
      {
        case: 'a missing officeCode',
        field: 'officeCode',
        value: undefined,
        expected: OFFICE_REQUIRED,
      },
      { case: 'a numeric officeCode', field: 'officeCode', value: 123, expected: OFFICE_REQUIRED },
      { case: 'an unknown role', field: 'role', value: 'NotARole', expected: ROLE_REQUIRED },
      { case: 'a missing role', field: 'role', value: undefined, expected: ROLE_REQUIRED },
      {
        case: 'the PrivilegedIdentityUser role',
        field: 'role',
        value: CamsRole.PrivilegedIdentityUser,
        expected: ROLE_REQUIRED,
      },
    ])('should reject $case', ({ field, value, expected }) => {
      const request = { ...validRequest, [field]: value };
      expect(validateObject(roleAssignmentGrantRequestSpec, request)).toEqual({
        reasonMap: { [field]: { reasons: [expected] } },
      });
    });
  });

  describe('scopes', () => {
    const NATIONAL = { regionId: null, officeCode: null };
    const REGION_2 = { regionId: '2', officeCode: null };
    const REGION_3 = { regionId: '3', officeCode: null };
    const MANHATTAN = { regionId: '2', officeCode: 'USTP_CAMS_Region_2_Office_Manhattan' };
    const BUFFALO = { regionId: '2', officeCode: 'USTP_CAMS_Region_2_Office_Buffalo' };
    const WILMINGTON = { regionId: '3', officeCode: 'USTP_CAMS_Region_3_Office_Wilmington' };

    test.each([
      { a: 'national', b: 'national', scopeA: NATIONAL, scopeB: NATIONAL, overlap: true },
      { a: 'national', b: 'a region', scopeA: NATIONAL, scopeB: REGION_2, overlap: true },
      { a: 'national', b: 'an office', scopeA: NATIONAL, scopeB: MANHATTAN, overlap: true },
      { a: 'a region', b: 'national', scopeA: REGION_2, scopeB: NATIONAL, overlap: true },
      { a: 'a region', b: 'the same region', scopeA: REGION_2, scopeB: REGION_2, overlap: true },
      { a: 'a region', b: 'another region', scopeA: REGION_2, scopeB: REGION_3, overlap: false },
      {
        a: 'a region',
        b: 'one of its offices',
        scopeA: REGION_2,
        scopeB: MANHATTAN,
        overlap: true,
      },
      { a: 'an office', b: 'its region', scopeA: MANHATTAN, scopeB: REGION_2, overlap: true },
      { a: 'an office', b: 'national', scopeA: MANHATTAN, scopeB: NATIONAL, overlap: true },
      {
        a: 'an office',
        b: "another region's office",
        scopeA: MANHATTAN,
        scopeB: WILMINGTON,
        overlap: false,
      },
      {
        a: 'a region',
        b: "another region's office",
        scopeA: REGION_2,
        scopeB: WILMINGTON,
        overlap: false,
      },
      { a: 'an office', b: 'the same office', scopeA: MANHATTAN, scopeB: MANHATTAN, overlap: true },
      { a: 'an office', b: 'another office', scopeA: MANHATTAN, scopeB: BUFFALO, overlap: false },
    ])('should say $a and $b overlap: $overlap', ({ scopeA, scopeB, overlap }) => {
      expect(scopesOverlap(scopeA, scopeB)).toBe(overlap);
    });

    test.each([
      { name: 'national', scope: NATIONAL, officeName: undefined, label: 'All Regions' },
      { name: 'a region', scope: REGION_2, officeName: undefined, label: 'Region 2 - All Offices' },
      {
        name: 'an office with its name',
        scope: MANHATTAN,
        officeName: 'Manhattan',
        label: 'Region 2 - Manhattan',
      },
      {
        name: 'an office without a name',
        scope: MANHATTAN,
        officeName: undefined,
        label: 'Region 2 - USTP_CAMS_Region_2_Office_Manhattan',
      },
      {
        name: 'an office with an empty name',
        scope: MANHATTAN,
        officeName: '',
        label: 'Region 2 - USTP_CAMS_Region_2_Office_Manhattan',
      },
    ])('should label $name as "$label"', ({ scope, officeName, label }) => {
      expect(scopeLabel(scope, officeName)).toEqual(label);
    });
  });

  describe('toPermissionChange', () => {
    const replacingPermission: UserRoleAssignment = {
      documentType: 'USER_ROLE_ASSIGNMENT',
      id: 'assignment-2',
      userId: 'user-1',
      userName: 'Sarah Williams',
      role: CamsRole.TrialAttorney,
      regionId: '03',
      officeCode: null,
      assignedBy: 'super-2',
      assignedByName: 'Lisa Okafor',
      assignedAt: '2026-11-25T16:30:00.000Z',
      active: true,
      activeKey: 'TrialAttorney|03|*',
    };

    test('should show a grant as a change from nothing to the granted permission', () => {
      const change = toPermissionChange(auditEntry());

      expect(change).toEqual({
        auditId: 'audit-1',
        assignmentId: 'assignment-1',
        userId: 'user-1',
        userName: 'Sarah Williams',
        performedBy: 'super-1',
        performedByName: 'Maria Garcia',
        performedAt: '2026-11-20T15:00:00.000Z',
        kind: 'granted',
        previous: null,
        next: { role: CamsRole.TrialAttorney, regionId: '02', officeCode: BUFFALO },
      });
    });

    test('should keep a Super User grant unscoped', () => {
      const superUserGrant = auditEntry({
        role: CamsRole.SuperUser,
        regionId: null,
        officeCode: null,
        newState: { role: CamsRole.SuperUser, regionId: null, officeCode: null, active: true },
      });

      expect(toPermissionChange(superUserGrant).next).toEqual({
        role: CamsRole.SuperUser,
        regionId: null,
        officeCode: null,
      });
    });

    test('should show a removal as a change from the removed permission to nothing, by the remover', () => {
      const change = toPermissionChange(deactivation({ replacedByAssignmentId: null }));

      expect(change).toEqual({
        ...DEACTIVATION_ROW_FIELDS,
        kind: 'removed',
        previous: { role: CamsRole.TrialAttorney, regionId: '02', officeCode: null },
        next: null,
      });
    });

    test('should still show a removal when a replacing permission is passed', () => {
      const change = toPermissionChange(
        deactivation({ replacedByAssignmentId: null }),
        replacingPermission,
      );

      expect(change.kind).toEqual('removed');
      expect(change.next).toBeNull();
    });

    test('should show a replacement as a change from the replaced permission to the one that replaced it', () => {
      const change = toPermissionChange(
        deactivation({ replacedByAssignmentId: 'assignment-2' }),
        replacingPermission,
      );

      expect(change).toEqual({
        ...DEACTIVATION_ROW_FIELDS,
        kind: 'replaced',
        previous: { role: CamsRole.TrialAttorney, regionId: '02', officeCode: null },
        next: { role: CamsRole.TrialAttorney, regionId: '03', officeCode: null },
      });
    });

    test('should still show a replacement when the replacing permission is not supplied', () => {
      const change = toPermissionChange(deactivation({ replacedByAssignmentId: 'assignment-2' }));

      expect(change).toEqual({
        ...DEACTIVATION_ROW_FIELDS,
        kind: 'replaced',
        previous: { role: CamsRole.TrialAttorney, regionId: '02', officeCode: null },
        next: null,
      });
    });
  });

  describe('isUnscopedRole', () => {
    test('should treat only Super User as granted without a region or office', () => {
      const unscoped = CamsRoles.filter((role) => isUnscopedRole(role));
      expect(unscoped).toEqual([CamsRole.SuperUser]);
    });

    test('should treat no role selected as scoped', () => {
      expect(isUnscopedRole(null)).toBe(false);
    });
  });
});
