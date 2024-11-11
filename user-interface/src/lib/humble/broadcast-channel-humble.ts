export class BroadcastChannelHumble {
  private channel: BroadcastChannel;

  constructor(channelName: string) {
    this.channel = new BroadcastChannel(channelName);
  }

  onMessage(handler: (event: MessageEvent) => void) {
    this.channel.onmessage = handler;
  }

  postMessage(message: unknown) {
    this.channel.postMessage(message);
  }

  close() {
    this.channel.close();
  }
}
