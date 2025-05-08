import getAppConfiguration from '@/configuration/appConfiguration';

export function isCamsApi(url: string) {
  return url.startsWith(getApiConfiguration().baseUrl);
}

function getApiConfiguration() {
  const config = getAppConfiguration();

  const basePath = config.basePath;
  const server = config.serverHostName;
  const port = config.serverPort;
  const protocol = config.serverProtocol;

  return {
    basePath,
    server,
    port,
    protocol,
    baseUrl: `${protocol || 'https'}://${server}${port ? ':' + port : ''}${basePath ?? ''}`,
  };
}

export default getApiConfiguration;
