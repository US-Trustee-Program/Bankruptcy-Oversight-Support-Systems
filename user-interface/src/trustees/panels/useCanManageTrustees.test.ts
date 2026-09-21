import { renderHook } from '@testing-library/react';
import { describe, test, expect, beforeEach } from 'vitest';
import { useCanManageTrustees } from './useCanManageTrustees';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';

describe('useCanManageTrustees', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns true when the current user has the TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);

    const { result } = renderHook(() => useCanManageTrustees());

    expect(result.current).toBe(true);
  });

  test('returns false when the current user does not have the TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    const { result } = renderHook(() => useCanManageTrustees());

    expect(result.current).toBe(false);
  });

  test('returns false when there is no session', () => {
    const { result } = renderHook(() => useCanManageTrustees());

    expect(result.current).toBe(false);
  });
});
