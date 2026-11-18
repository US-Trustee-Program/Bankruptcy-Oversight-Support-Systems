/**
 * The hosts a superuser command may write to by default: a Mongo on this machine, or the local
 * Podman service. A shared Cosmos account is allowed only when the caller names it explicitly
 * (the Azure DevOps step, or a developer deliberately targeting a branch deploy).
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'mongodb']);

function hostName(hostAndPort: string): string {
  if (hostAndPort.startsWith('[')) {
    return hostAndPort.slice(1, hostAndPort.indexOf(']')).toLowerCase();
  }
  return hostAndPort.split(':')[0].toLowerCase();
}

/**
 * A local Mongo here never uses TLS or a proxy, but Cosmos requires TLS. So a local host with
 * either is likely a tunnel to a shared database (e.g. ssh -L to Cosmos). Option names are
 * case-insensitive in Mongo URIs.
 */
function usesTlsOrProxy(query: string): boolean {
  return [...new URLSearchParams(query)].some(([name, value]) => {
    const key = name.toLowerCase();
    if (key === 'tls' || key === 'ssl') return value !== 'false';
    return key.startsWith('tls') || key.startsWith('proxy');
  });
}

/**
 * Throws unless every host in the connection string is allowed: local hosts by default, or
 * exactly `cosmosHost` when one is given. Parses the URI rather than matching substrings, so
 * credentials, ports and host lists can't hide another host. Anything it can't parse is refused.
 */
export function assertAllowedMongo(
  connectionString: string | undefined,
  options: { cosmosHost?: string } = {},
): { hosts: string[] } {
  const cosmosHost = options.cosmosHost?.trim().toLowerCase();
  if (options.cosmosHost !== undefined && !cosmosHost) {
    throw new Error('--cosmos-host is blank.');
  }
  const allowed = cosmosHost ? new Set([cosmosHost]) : LOCAL_HOSTS;

  const uri = connectionString?.trim();
  if (!uri) throw new Error('MONGO_CONNECTION_STRING is not set.');
  if (uri.startsWith('mongodb+srv://')) {
    throw new Error('Refusing a mongodb+srv connection string: name a single mongodb:// host.');
  }
  const scheme = 'mongodb://';
  if (!uri.startsWith(scheme)) {
    throw new Error('Expected a mongodb:// connection string.');
  }

  const rest = uri.slice(scheme.length);
  const authorityEnd = rest.search(/[/?]/);
  const authority = authorityEnd === -1 ? rest : rest.slice(0, authorityEnd);
  const hostList = authority.slice(authority.lastIndexOf('@') + 1);
  if (!hostList) throw new Error('The connection string has no host.');

  const hosts = hostList.split(',').map(hostName);
  const refused = hosts.find((host) => !allowed.has(host));
  if (refused !== undefined) {
    throw new Error(
      cosmosHost
        ? `Refusing to write to ${refused}: the connection string is not for ${cosmosHost}.`
        : `Refusing to write to ${refused}: without --cosmos-host, superuser commands write to a ` +
            `local Mongo only (${[...LOCAL_HOSTS].join(', ')}).`,
    );
  }

  const queryStart = rest.indexOf('?');
  if (!cosmosHost && queryStart !== -1 && usesTlsOrProxy(rest.slice(queryStart + 1))) {
    throw new Error(
      'Refusing TLS or proxy options without --cosmos-host: a local Mongo uses neither, so this ' +
        'may be a tunnel to a shared database.',
    );
  }

  return { hosts };
}
