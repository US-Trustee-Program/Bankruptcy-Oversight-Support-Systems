import { HttpRequest } from '@azure/functions';

export function isAuthorized(request: HttpRequest) {
  const header = request.headers.get('Authorization');
  const parts = header ? header.split(' ') : ['', ''];
  return process.env.ADMIN_KEY && parts[0] === 'ApiKey' && parts[1] === process.env.ADMIN_KEY;
}
