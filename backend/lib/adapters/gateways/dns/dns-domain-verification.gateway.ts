import * as nodeDns from 'node:dns/promises';
import {
  DomainVerificationGateway,
  DomainVerificationResult,
} from '../../../use-cases/gateways.types';

const DNS_LOOKUP_TIMEOUT_MS = 3_000;

export interface DnsResolver {
  resolveMx: typeof nodeDns.resolveMx;
  resolve: typeof nodeDns.resolve;
}

function isDomainNotFoundError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code;
  return code === 'ENOTFOUND' || code === 'ENODATA';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error('DNS lookup timed out') as NodeJS.ErrnoException;
      error.code = 'ETIMEOUT';
      reject(error);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// The dns resolver is injected (defaulting to node:dns/promises) rather than imported
// directly, because node:dns/promises is an ES module whose exports can't be
// vi.spyOn()'d in tests -- injection lets tests spy on a plain object instead.
export class DnsDomainVerificationGateway implements DomainVerificationGateway {
  private readonly resolver: DnsResolver;

  constructor(resolver: DnsResolver = nodeDns) {
    this.resolver = resolver;
  }

  async verifyMailDomain(domain: string): Promise<DomainVerificationResult> {
    const mxResult = await this.checkMx(domain);
    if (mxResult === 'valid') return 'valid';

    const aResult = await this.checkA(domain);
    if (aResult === 'valid') return 'valid';

    // Only report 'not-found' when both lookups affirmatively confirm the domain
    // doesn't exist. If either was merely indeterminate (timeout, SERVFAIL, etc.),
    // we haven't actually confirmed absence, so fail open rather than reject.
    return mxResult === 'not-found' && aResult === 'not-found' ? 'not-found' : 'indeterminate';
  }

  private async checkMx(domain: string): Promise<DomainVerificationResult> {
    try {
      const mxRecords = await withTimeout(this.resolver.resolveMx(domain), DNS_LOOKUP_TIMEOUT_MS);
      return mxRecords.length > 0 ? 'valid' : 'not-found';
    } catch (error) {
      return isDomainNotFoundError(error) ? 'not-found' : 'indeterminate';
    }
  }

  private async checkA(domain: string): Promise<DomainVerificationResult> {
    try {
      const addresses = await withTimeout(this.resolver.resolve(domain), DNS_LOOKUP_TIMEOUT_MS);
      return addresses.length > 0 ? 'valid' : 'not-found';
    } catch (error) {
      return isDomainNotFoundError(error) ? 'not-found' : 'indeterminate';
    }
  }
}
