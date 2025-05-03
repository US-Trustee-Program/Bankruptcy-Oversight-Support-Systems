const basePath = import.meta.env['CAMS_BASE_PATH'];
const server = import.meta.env['CAMS_SERVER_HOSTNAME'];
const port = import.meta.env['CAMS_SERVER_PORT'];
const protocol = import.meta.env['CAMS_SERVER_PROTOCOL'];

export function isCamsApi(url: string) {
  return url.startsWith(ApiConfiguration.baseUrl);
}

export const ApiConfiguration = {
  basePath,
  baseUrl: protocol + '://' + server + (port ? ':' + port : '') + basePath,
  port,
  protocol,
  server,
};

export default ApiConfiguration;
