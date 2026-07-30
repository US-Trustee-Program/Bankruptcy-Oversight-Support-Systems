import { vi, Mocked } from 'vitest';
import { DnsDomainVerificationGateway, DnsResolver } from './dns-domain-verification.gateway';

function notFoundError(): NodeJS.ErrnoException {
  const error = new Error('queryA ENOTFOUND') as NodeJS.ErrnoException;
  error.code = 'ENOTFOUND';
  return error;
}

function noDataError(): NodeJS.ErrnoException {
  const error = new Error('queryMx ENODATA') as NodeJS.ErrnoException;
  error.code = 'ENODATA';
  return error;
}

function timeoutError(): NodeJS.ErrnoException {
  const error = new Error('queryMx ETIMEOUT') as NodeJS.ErrnoException;
  error.code = 'ETIMEOUT';
  return error;
}

describe('DnsDomainVerificationGateway', () => {
  let gateway: DnsDomainVerificationGateway;
  let resolver: Mocked<DnsResolver>;

  beforeEach(() => {
    resolver = {
      resolveMx: vi.fn(),
      resolve: vi.fn(),
    } as unknown as Mocked<DnsResolver>;
    gateway = new DnsDomainVerificationGateway(resolver);
  });

  test('returns valid when the domain has MX records', async () => {
    resolver.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('valid');
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  test('falls back to an A-record lookup when the MX lookup resolves an empty list', async () => {
    resolver.resolveMx.mockResolvedValue([]);
    resolver.resolve.mockResolvedValue(['1.2.3.4']);

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('valid');
  });

  test('falls back to an A-record lookup when the MX lookup rejects with a not-found error', async () => {
    resolver.resolveMx.mockRejectedValue(notFoundError());
    resolver.resolve.mockResolvedValue(['1.2.3.4']);

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('valid');
  });

  test('still attempts the A-record lookup when the MX lookup fails with a transient error', async () => {
    resolver.resolveMx.mockRejectedValue(timeoutError());
    resolver.resolve.mockResolvedValue(['1.2.3.4']);

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('valid');
    expect(resolver.resolve).toHaveBeenCalledWith('example.com');
  });

  test('returns not-found only when both MX and A lookups affirmatively confirm absence', async () => {
    resolver.resolveMx.mockRejectedValue(notFoundError());
    resolver.resolve.mockRejectedValue(noDataError());

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('not-found');
  });

  test('returns indeterminate when the MX lookup fails transiently and the A lookup also cannot confirm absence', async () => {
    resolver.resolveMx.mockRejectedValue(timeoutError());
    resolver.resolve.mockRejectedValue(timeoutError());

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('indeterminate');
  });

  test('returns indeterminate when MX affirmatively confirms absence but the A lookup is transient', async () => {
    resolver.resolveMx.mockRejectedValue(notFoundError());
    resolver.resolve.mockRejectedValue(timeoutError());

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('indeterminate');
  });

  test('returns not-found when the A-record lookup resolves an empty list after MX not-found', async () => {
    resolver.resolveMx.mockRejectedValue(notFoundError());
    resolver.resolve.mockResolvedValue([]);

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('not-found');
  });

  test('treats a resolver call that hangs past the timeout as indeterminate', async () => {
    vi.useFakeTimers();
    resolver.resolveMx.mockImplementation(() => new Promise(() => {}));
    resolver.resolve.mockImplementation(() => new Promise(() => {}));

    const resultPromise = gateway.verifyMailDomain('example.com');
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await resultPromise;

    expect(result).toBe('indeterminate');
    vi.useRealTimers();
  });
});
