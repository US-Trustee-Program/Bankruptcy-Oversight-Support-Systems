import { renderHook } from '@testing-library/react';
import useCanManageTrustees from './UseCanManageTrustees';
import { CamsRole } from '@common/cams/roles';
import TestingUtilities from '@/lib/testing/testing-utilities';
import LocalStorage from '@/lib/utils/local-storage';

describe('useCanManageTrustees', () => {
  beforeEach(() => {
    LocalStorage.removeSession();
  });

  test('returns true when the user has the TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);

    const { result } = renderHook(() => useCanManageTrustees());

    expect(result.current).toBe(true);
  });

  test('returns false when the user lacks the TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    const { result } = renderHook(() => useCanManageTrustees());

    expect(result.current).toBe(false);
  });

  test('returns false when there is no session', () => {
    const { result } = renderHook(() => useCanManageTrustees());

    expect(result.current).toBe(false);
  });
});
