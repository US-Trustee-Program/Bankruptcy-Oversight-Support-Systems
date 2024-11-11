import { BroadcastChannelHumble } from '@/lib/humble/broadcast-channel-humble';
import { LOGOUT_PATH } from '@/login/login-library';

let channel: BroadcastChannelHumble;

export function handleLogout() {
  const { host, protocol } = window.location;
  const logoutUri = protocol + '//' + host + LOGOUT_PATH;
  window.location.assign(logoutUri);
  channel?.close();
}

export function initializeBroadcastLogout() {
  channel = new BroadcastChannelHumble('CAMS_logout');
  channel.onMessage(handleLogout);
}

export function broadcastLogout() {
  channel?.postMessage('Logout all windows');
}
