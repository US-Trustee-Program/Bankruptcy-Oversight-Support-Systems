import { redirectTo } from '@/lib/hooks/UseCamsNavigator';
import { BroadcastChannelHumble } from '@/lib/humble/broadcast-channel-humble';
import { LOGOUT_PATH } from '@/login/login-library';

let channel: BroadcastChannelHumble;

export function handleLogoutBroadcast() {
  const { host, protocol } = window.location;
  const logoutUri = protocol + '//' + host + LOGOUT_PATH;
  redirectTo(logoutUri);
  channel?.close();
}

export function initializeBroadcastLogout() {
  channel = new BroadcastChannelHumble('CAMS_logout');
  channel.onMessage(handleLogoutBroadcast);
}

export function broadcastLogout() {
  channel?.postMessage('Logout all windows');
}
