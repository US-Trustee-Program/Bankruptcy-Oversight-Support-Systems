import { BroadcastChannelHumble } from '@/lib/humble/broadcast-channel-humble';
import { broadcastLogout, initializeBroadcastLogout } from '@/login/broadcast-logout';

describe('Broadcast Logout', () => {
  test('should handle broadcast-logout properly', () => {
    const postMessageSpy = vi
      .spyOn(BroadcastChannelHumble.prototype, 'postMessage')
      .mockReturnValue();
    // eslint-disable-next-line @typescript-eslint/ban-types
    let onMessageFn: Function = vi.fn();
    const onMessageSpy = vi
      .spyOn(BroadcastChannelHumble.prototype, 'onMessage')
      .mockImplementation((arg) => {
        onMessageFn = arg;
      });

    const closeSpy = vi.spyOn(BroadcastChannelHumble.prototype, 'close').mockReturnValue();

    global.window = Object.create(window);
    global.window.location = {
      ancestorOrigins: {
        length: 1,
        contains: vi.fn(),
        item: vi.fn(() => ''),
        [Symbol.iterator]: function (): ArrayIterator<string> {
          throw new Error('Function not implemented.');
        },
      },
      hash: '',
      host: 'some-host',
      hostname: '',
      href: '',
      origin: 'http://dummy.com',
      pathname: '',
      port: '',
      protocol: 'http:',
      search: '',
      assign: function (url: string | URL): void {
        console.log('URL::::::: ' + url);
        return;
      },
      reload: function (): void {
        throw new Error('Function not implemented.');
      },
      replace: function (_url: string | URL): void {
        throw new Error('Function not implemented.');
      },
    };
    vi.spyOn(global.window.location, 'assign');
    const expectedUrl =
      global.window.location.protocol + '//' + global.window.location.host + '/logout';

    initializeBroadcastLogout();
    broadcastLogout();
    expect(postMessageSpy).toHaveBeenCalledWith('I am testing this');
    expect(onMessageSpy).toHaveBeenCalledWith(expect.any(Function));
    expect(onMessageFn).toEqual(expect.any(Function));
    onMessageFn();
    expect(closeSpy).toHaveBeenCalled();
    expect(global.window.location.assign).toHaveBeenCalledWith(expectedUrl);
    //TODO: find a way to actually have the postMessage event be handled
  });
});
