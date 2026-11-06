import { describe, test, expect } from 'vitest';
import { CamsRole } from './roles';
import { validateObject, VALID } from './validation';
import {
  activeKeyFor,
  ROLE_ASSIGNMENT_REASON_MAX_LENGTH,
  RoleAssignmentGrantRequest,
  roleAssignmentGrantRequestSpec,
} from './user-access';

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

  describe('roleAssignmentGrantRequestSpec', () => {
    const validRequest: RoleAssignmentGrantRequest = {
      userId: 'user-1',
      role: CamsRole.TrialAttorney,
      officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
      reason: 'New hire in the Manhattan office',
    };

    test('should accept a complete request', () => {
      expect(validateObject(roleAssignmentGrantRequestSpec, validRequest)).toEqual(VALID);
    });

    test('should accept a reason at the maximum length once trimmed', () => {
      const reason = `  ${'x'.repeat(ROLE_ASSIGNMENT_REASON_MAX_LENGTH)}  `;
      const request = { ...validRequest, reason };
      expect(validateObject(roleAssignmentGrantRequestSpec, request)).toEqual(VALID);
    });

    test.each([
      CamsRole.CaseAssignmentManager,
      CamsRole.TrialAttorney,
      CamsRole.LeadTrialAttorney,
      CamsRole.DataVerifier,
      CamsRole.TrusteeAdmin,
      CamsRole.Auditor,
      CamsRole.Paralegal,
    ])('should accept the role %s', (role) => {
      const request = { ...validRequest, role };
      expect(validateObject(roleAssignmentGrantRequestSpec, request)).toEqual(VALID);
    });

    const USER_REQUIRED = 'A user is required';
    const ROLE_REQUIRED = 'A valid role is required';
    const OFFICE_REQUIRED = 'An office is required';
    const REASON_REQUIRED = 'A reason is required';
    const REASON_TOO_LONG = `Max length ${ROLE_ASSIGNMENT_REASON_MAX_LENGTH} characters`;

    test.each([
      { case: 'an empty userId', field: 'userId', value: '', expected: USER_REQUIRED },
      { case: 'a blank userId', field: 'userId', value: '   ', expected: USER_REQUIRED },
      { case: 'a missing userId', field: 'userId', value: undefined, expected: USER_REQUIRED },
      { case: 'a null userId', field: 'userId', value: null, expected: USER_REQUIRED },
      { case: 'an array userId', field: 'userId', value: ['user-1'], expected: USER_REQUIRED },
      { case: 'an empty officeCode', field: 'officeCode', value: '', expected: OFFICE_REQUIRED },
      { case: 'a blank officeCode', field: 'officeCode', value: '  ', expected: OFFICE_REQUIRED },
      {
        case: 'a missing officeCode',
        field: 'officeCode',
        value: undefined,
        expected: OFFICE_REQUIRED,
      },
      { case: 'a numeric officeCode', field: 'officeCode', value: 123, expected: OFFICE_REQUIRED },
      { case: 'an empty reason', field: 'reason', value: '', expected: REASON_REQUIRED },
      { case: 'a blank reason', field: 'reason', value: '   ', expected: REASON_REQUIRED },
      { case: 'a missing reason', field: 'reason', value: undefined, expected: REASON_REQUIRED },
      { case: 'an array reason', field: 'reason', value: ['why'], expected: REASON_REQUIRED },
      {
        case: 'a reason over the maximum length',
        field: 'reason',
        value: 'x'.repeat(ROLE_ASSIGNMENT_REASON_MAX_LENGTH + 1),
        expected: REASON_TOO_LONG,
      },
      { case: 'an unknown role', field: 'role', value: 'NotARole', expected: ROLE_REQUIRED },
      { case: 'a missing role', field: 'role', value: undefined, expected: ROLE_REQUIRED },
      {
        case: 'the PrivilegedIdentityUser role',
        field: 'role',
        value: CamsRole.PrivilegedIdentityUser,
        expected: ROLE_REQUIRED,
      },
      {
        case: 'the SuperUser role',
        field: 'role',
        value: CamsRole.SuperUser,
        expected: ROLE_REQUIRED,
      },
    ])('should reject $case', ({ field, value, expected }) => {
      const request = { ...validRequest, [field]: value };
      expect(validateObject(roleAssignmentGrantRequestSpec, request)).toEqual({
        reasonMap: { [field]: { reasons: [expected] } },
      });
    });
  });
});
