const basePath = window.CAMS_CONFIGURATION.CAMS_BASE_PATH;
const server = window.CAMS_CONFIGURATION.CAMS_SERVER_HOSTNAME;
const port = window.CAMS_CONFIGURATION.CAMS_SERVER_PORT;
const protocol = window.CAMS_CONFIGURATION.CAMS_SERVER_PROTOCOL;

export function isCamsApi(url: string) {
  return url.startsWith(ApiConfiguration.baseUrl);
}

export const ApiConfiguration = {
  basePath,
  server,
  port,
  protocol,
  baseUrl: protocol + '://' + server + (port ? ':' + port : '') + basePath,
};

export default ApiConfiguration;
