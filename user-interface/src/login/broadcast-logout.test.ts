import { BroadcastChannelHumble } from '@/lib/humble/broadcast-channel-humble';
import {
  broadcastLogout,
  handleLogoutBroadcast,
  initializeBroadcastLogout,
} from '@/login/broadcast-logout';

describe('Broadcast Logout', () => {
  test('should handle broadcast-logout properly', () => {
    const postMessageSpy = vi
      .spyOn(BroadcastChannelHumble.prototype, 'postMessage')
      .mockReturnValue();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    let onMessageFn: Function = vi.fn();
    const onMessageSpy = vi
      .spyOn(BroadcastChannelHumble.prototype, 'onMessage')
      .mockImplementation((arg) => {
        onMessageFn = arg;
      });

    const closeSpy = vi.spyOn(BroadcastChannelHumble.prototype, 'close').mockReturnValue();

    Object.defineProperty(global, 'window', Object.create(window));
    // @ts-expect-error `location` is a readonly property. As this is just a test, we do not care.
    global.window.location = {
      host: 'some-host',
      protocol: 'http:',
      assign: function (_url: string | URL): void {},
    } as unknown as Location;
    const assignSpy = vi.spyOn(global.window.location, 'assign');
    const expectedUrl =
      global.window.location.protocol + '//' + global.window.location.host + '/logout';

    initializeBroadcastLogout();
    broadcastLogout();

    // Validate broadcastLogout function
    expect(postMessageSpy).toHaveBeenCalledWith('Logout all windows');

    // Validate initializeBroadcastLogout function
    expect(onMessageSpy).toHaveBeenCalledWith(handleLogoutBroadcast);
    expect(onMessageFn).toEqual(handleLogoutBroadcast);

    // Validate handleLogout function
    onMessageFn();
    expect(closeSpy).toHaveBeenCalled();
    expect(assignSpy).toHaveBeenCalledWith(expectedUrl);
  });
});
