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
      resolve6: vi.fn(),
      cancel: vi.fn(),
    } as unknown as Mocked<DnsResolver>;
    gateway = new DnsDomainVerificationGateway(() => resolver);
  });

  test('returns valid when the domain has MX records', async () => {
    resolver.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('valid');
    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(resolver.resolve6).not.toHaveBeenCalled();
  });

  test('calls resolveMx with the actual domain rather than a hardcoded value', async () => {
    resolver.resolveMx.mockResolvedValue([{ exchange: 'mail.ust.doj.gov', priority: 10 }]);

    await gateway.verifyMailDomain('ust.doj.gov');

    expect(resolver.resolveMx).toHaveBeenCalledWith('ust.doj.gov');
  });

  test('falls back to an A-record lookup when the MX lookup resolves an empty list', async () => {
    resolver.resolveMx.mockResolvedValue([]);
    resolver.resolve.mockResolvedValue(['1.2.3.4']);

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('valid');
    expect(resolver.resolve6).not.toHaveBeenCalled();
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

  test('falls back to an AAAA-record lookup when MX and A both confirm absence', async () => {
    resolver.resolveMx.mockRejectedValue(notFoundError());
    resolver.resolve.mockRejectedValue(notFoundError());
    resolver.resolve6.mockResolvedValue(['::1']);

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('valid');
    expect(resolver.resolve6).toHaveBeenCalledWith('example.com');
  });

  test('returns not-found only when MX, A, and AAAA all affirmatively confirm absence', async () => {
    resolver.resolveMx.mockRejectedValue(notFoundError());
    resolver.resolve.mockRejectedValue(noDataError());
    resolver.resolve6.mockRejectedValue(notFoundError());

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('not-found');
  });

  test('returns indeterminate when MX times out even though A and AAAA both confirm absence', async () => {
    // This is the combination a coverage tool can miss: the final line still evaluates to
    // 'indeterminate' whether MX, A, or AAAA is the indeterminate one, so 100% branch/line
    // coverage on that expression doesn't guarantee every source of indeterminacy was exercised.
    resolver.resolveMx.mockRejectedValue(timeoutError());
    resolver.resolve.mockRejectedValue(notFoundError());
    resolver.resolve6.mockRejectedValue(notFoundError());

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('indeterminate');
  });

  test('returns indeterminate when MX fails transiently and the A and AAAA lookups also cannot confirm absence', async () => {
    resolver.resolveMx.mockRejectedValue(timeoutError());
    resolver.resolve.mockRejectedValue(timeoutError());
    resolver.resolve6.mockRejectedValue(timeoutError());

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('indeterminate');
  });

  test('returns indeterminate when MX affirmatively confirms absence but the A lookup is transient', async () => {
    resolver.resolveMx.mockRejectedValue(notFoundError());
    resolver.resolve.mockRejectedValue(timeoutError());
    resolver.resolve6.mockRejectedValue(timeoutError());

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('indeterminate');
  });

  test('returns not-found when the AAAA-record lookup resolves an empty list after MX and A not-found', async () => {
    resolver.resolveMx.mockRejectedValue(notFoundError());
    resolver.resolve.mockResolvedValue([]);
    resolver.resolve6.mockResolvedValue([]);

    const result = await gateway.verifyMailDomain('example.com');

    expect(result).toBe('not-found');
  });

  test('treats a resolver call that hangs past the timeout as indeterminate', async () => {
    vi.useFakeTimers();
    resolver.resolveMx.mockImplementation(() => new Promise(() => {}));
    resolver.resolve.mockImplementation(() => new Promise(() => {}));
    resolver.resolve6.mockImplementation(() => new Promise(() => {}));

    const resultPromise = gateway.verifyMailDomain('example.com');
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await resultPromise;

    expect(result).toBe('indeterminate');
    // One cancel() per lookup that actually timed out (MX, then A, then AAAA), rather
    // than leaving each hung query running detached after we've moved on.
    expect(resolver.cancel).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  test('does not cancel the resolver when a lookup settles before the timeout', async () => {
    resolver.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);

    await gateway.verifyMailDomain('example.com');

    expect(resolver.cancel).not.toHaveBeenCalled();
  });

  test('builds a fresh resolver for each of the MX, A, and AAAA lookups', async () => {
    const resolverFactory = vi.fn(() => ({
      resolveMx: vi.fn().mockRejectedValue(notFoundError()),
      resolve: vi.fn().mockRejectedValue(notFoundError()),
      resolve6: vi.fn().mockRejectedValue(notFoundError()),
      cancel: vi.fn(),
    }));
    const isolatedGateway = new DnsDomainVerificationGateway(resolverFactory);

    await isolatedGateway.verifyMailDomain('example.com');

    expect(resolverFactory).toHaveBeenCalledTimes(3);
  });
});
