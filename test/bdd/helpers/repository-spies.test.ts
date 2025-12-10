import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { spyOnAllGatewayMethods, clearAllRepositorySpies } from './repository-spies';

/**
 * Test class to validate spy behavior
 */
class TestGateway {
  public callCount = 0;

  foo(arg: string): string {
    this.callCount += 1;
    return `original-foo-${arg}`;
  }

  bar(): string {
    this.callCount += 1;
    return 'original-bar';
  }

  baz(x: number, y: number): number {
    this.callCount += 1;
    return x + y;
  }
}

/**
 * Focused tests for repository spy helpers
 *
 * These tests validate that our spy infrastructure behaves correctly:
 * - Explicit mocks work as expected
 * - Unmocked methods throw with diagnostic messages
 * - Spy cleanup restores original behavior
 */
describe('repository-spies helpers', () => {
  afterEach(() => {
    // Always clean up spies to ensure test isolation
    clearAllRepositorySpies();
  });

  describe('spyOnAllGatewayMethods', () => {
    it('uses explicit mock implementations when provided', () => {
      const fooMock = vi.fn().mockReturnValue('mocked-foo');

      spyOnAllGatewayMethods(TestGateway, 'TestGateway', {
        foo: fooMock,
      });

      const gateway = new TestGateway();
      const result = gateway.foo('test-arg');

      expect(result).toBe('mocked-foo');
      expect(fooMock).toHaveBeenCalledTimes(1);
      expect(fooMock).toHaveBeenCalledWith('test-arg');
    });

    it('throws diagnostic error for unmocked methods', () => {
      spyOnAllGatewayMethods(TestGateway, 'TestGateway', {
        foo: vi.fn().mockReturnValue('mocked'),
      });

      const gateway = new TestGateway();

      // bar is not mocked, so it should throw
      expect(() => gateway.bar()).toThrowError(/BDD TEST/i);
      expect(() => gateway.bar()).toThrowError(/TestGateway\.bar/i);
      expect(() => gateway.bar()).toThrowError(/Unmocked/i);
    });

    it('includes method arguments in error message for debugging', () => {
      spyOnAllGatewayMethods(TestGateway, 'TestGateway');

      const gateway = new TestGateway();

      // Call with specific args and verify they appear in error
      expect(() => gateway.baz(10, 20)).toThrowError(/TestGateway\.baz/);
      expect(() => gateway.baz(10, 20)).toThrowError(/\[10,20\]/); // Args in JSON format
    });

    it('handles multiple mocked methods on same gateway', () => {
      const fooMock = vi.fn().mockReturnValue('mocked-foo');
      const bazMock = vi.fn().mockReturnValue(42);

      spyOnAllGatewayMethods(TestGateway, 'TestGateway', {
        foo: fooMock,
        baz: bazMock,
      });

      const gateway = new TestGateway();

      expect(gateway.foo('x')).toBe('mocked-foo');
      expect(gateway.baz(1, 2)).toBe(42);

      expect(fooMock).toHaveBeenCalledWith('x');
      expect(bazMock).toHaveBeenCalledWith(1, 2);

      // bar is still unmocked
      expect(() => gateway.bar()).toThrowError(/Unmocked/);
    });
  });

  describe('clearAllRepositorySpies', () => {
    it('restores original implementations after spy cleanup', () => {
      const fooMock = vi.fn().mockReturnValue('mocked-foo');

      // Install spy
      spyOnAllGatewayMethods(TestGateway, 'TestGateway', {
        foo: fooMock,
      });

      const gatewayWithSpy = new TestGateway();
      expect(gatewayWithSpy.foo('test')).toBe('mocked-foo');
      expect(fooMock).toHaveBeenCalledTimes(1);

      // Clear spies
      clearAllRepositorySpies();

      // Create new instance and verify original behavior restored
      const gatewayAfterClear = new TestGateway();
      const result = gatewayAfterClear.foo('test');

      expect(result).toBe('original-foo-test');
      expect(gatewayAfterClear.callCount).toBe(1);
    });

    it('allows re-spying after cleanup', () => {
      // First spy
      spyOnAllGatewayMethods(TestGateway, 'TestGateway', {
        foo: vi.fn().mockReturnValue('first-mock'),
      });

      let gateway = new TestGateway();
      expect(gateway.foo('x')).toBe('first-mock');

      // Clear and re-spy with different mock
      clearAllRepositorySpies();
      spyOnAllGatewayMethods(TestGateway, 'TestGateway', {
        foo: vi.fn().mockReturnValue('second-mock'),
      });

      gateway = new TestGateway();
      expect(gateway.foo('y')).toBe('second-mock');
    });
  });

  describe('spy behavior edge cases', () => {
    it('handles gateways with no methods to spy', () => {
      class EmptyGateway {}

      // Should not throw
      expect(() => {
        spyOnAllGatewayMethods(EmptyGateway, 'EmptyGateway');
      }).not.toThrow();
    });

    it('handles undefined/null class gracefully', () => {
      // Should log error and not throw
      expect(() => {
        spyOnAllGatewayMethods(undefined as any, 'UndefinedClass');
      }).not.toThrow();

      expect(() => {
        spyOnAllGatewayMethods(null as any, 'NullClass');
      }).not.toThrow();
    });

    it('does not spy on constructor', () => {
      spyOnAllGatewayMethods(TestGateway, 'TestGateway');

      // Constructor should still work normally
      expect(() => new TestGateway()).not.toThrow();

      const gateway = new TestGateway();
      expect(gateway).toBeInstanceOf(TestGateway);
      expect(gateway.callCount).toBe(0); // Constructor didn't modify callCount
    });
  });
});
