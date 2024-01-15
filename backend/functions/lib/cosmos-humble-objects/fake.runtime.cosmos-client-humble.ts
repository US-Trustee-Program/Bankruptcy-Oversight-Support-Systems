import { HumbleClient } from '../testing/mock.cosmos-client-humble';
import { RuntimeState } from '../use-cases/gateways.types';

export default class FakeRuntimeStateCosmosClientHumble extends HumbleClient<RuntimeState> {}
