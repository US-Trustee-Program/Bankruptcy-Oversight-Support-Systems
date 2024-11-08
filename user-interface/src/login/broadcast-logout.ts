import { LOGOUT_PATH } from '@/login/login-library';

let channel: BroadcastChannel;

function handleLogout() {
  const { host, protocol } = window.location;
  const logoutUri = protocol + '//' + host + LOGOUT_PATH;
  window.location.assign(logoutUri);
  channel?.close();
}

export function initializeBroadcastLogout() {
  channel = new BroadcastChannel('CAMS_logout');
  channel.onmessage = handleLogout;
}

export function broadcastLogout() {
  channel?.postMessage('');
}
