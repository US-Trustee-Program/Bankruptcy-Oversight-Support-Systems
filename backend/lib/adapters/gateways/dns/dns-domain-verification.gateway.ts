import * as nodeDns from 'node:dns/promises';
import {
  DomainVerificationGateway,
  DomainVerificationResult,
} from '../../../use-cases/gateways.types';

const DNS_LOOKUP_TIMEOUT_MS = 3_000;

export interface DnsResolver {
  resolveMx: typeof nodeDns.resolveMx;
  resolve: typeof nodeDns.resolve;
  resolve6: typeof nodeDns.resolve6;
  cancel: () => void;
}

export type DnsResolverFactory = () => DnsResolver;

function isDomainNotFoundError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code;
  return code === 'ENOTFOUND' || code === 'ENODATA';
}

function withTimeout<T>(promise: Promise<T>, ms: number, cancel: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      cancel();
      const error = new Error('DNS lookup timed out') as NodeJS.ErrnoException;
      error.code = 'ETIMEOUT';
      reject(error);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          resolve(value);
        }
      },
      (error) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(error);
        }
      },
    );
  });
}

// A resolver factory is injected (defaulting to node:dns/promises Resolver instances)
// rather than a single resolver, because node:dns/promises is an ES module whose
// exports can't be vi.spyOn()'d in tests -- injection lets tests substitute a plain
// object. A fresh resolver per lookup call also keeps cancel() scoped to that call.
export class DnsDomainVerificationGateway implements DomainVerificationGateway {
  private readonly resolverFactory: DnsResolverFactory;

  constructor(resolverFactory: DnsResolverFactory = () => new nodeDns.Resolver()) {
    this.resolverFactory = resolverFactory;
  }

  async verifyMailDomain(domain: string): Promise<DomainVerificationResult> {
    const mxResult = await this.checkMx(domain);
    if (mxResult === 'valid') return 'valid';

    const aResult = await this.checkA(domain);
    if (aResult === 'valid') return 'valid';

    const aaaaResult = await this.checkAaaa(domain);
    if (aaaaResult === 'valid') return 'valid';

    // Only report 'not-found' when every lookup affirmatively confirms the domain
    // doesn't exist. If any was merely indeterminate (timeout, SERVFAIL, etc.),
    // we haven't actually confirmed absence, so fail open rather than reject.
    const allConfirmedAbsent =
      mxResult === 'not-found' && aResult === 'not-found' && aaaaResult === 'not-found';
    return allConfirmedAbsent ? 'not-found' : 'indeterminate';
  }

  private async checkMx(domain: string): Promise<DomainVerificationResult> {
    const resolver = this.resolverFactory();
    try {
      const mxRecords = await withTimeout(resolver.resolveMx(domain), DNS_LOOKUP_TIMEOUT_MS, () =>
        resolver.cancel(),
      );
      return mxRecords.length > 0 ? 'valid' : 'not-found';
    } catch (error) {
      return isDomainNotFoundError(error) ? 'not-found' : 'indeterminate';
    }
  }

  private async checkA(domain: string): Promise<DomainVerificationResult> {
    const resolver = this.resolverFactory();
    try {
      const addresses = await withTimeout(resolver.resolve(domain), DNS_LOOKUP_TIMEOUT_MS, () =>
        resolver.cancel(),
      );
      return addresses.length > 0 ? 'valid' : 'not-found';
    } catch (error) {
      return isDomainNotFoundError(error) ? 'not-found' : 'indeterminate';
    }
  }

  private async checkAaaa(domain: string): Promise<DomainVerificationResult> {
    const resolver = this.resolverFactory();
    try {
      const addresses = await withTimeout(resolver.resolve6(domain), DNS_LOOKUP_TIMEOUT_MS, () =>
        resolver.cancel(),
      );
      return addresses.length > 0 ? 'valid' : 'not-found';
    } catch (error) {
      return isDomainNotFoundError(error) ? 'not-found' : 'indeterminate';
    }
  }
}
