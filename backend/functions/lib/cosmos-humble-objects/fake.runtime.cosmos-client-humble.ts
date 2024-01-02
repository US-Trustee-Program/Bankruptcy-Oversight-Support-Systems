import { RuntimeState } from '../use-cases/gateways.types';

interface QueryParams {
  name: string;
  value: string;
}

interface QueryOptions {
  query: string;
  parameters: QueryParams[];
}

export default class FakeRuntimeStateCosmosClientHumble {
  private syncStates: RuntimeState[] = [];

  public database(_databaseId: string) {
    return {
      container: (_containerName: string) => {
        return {
          items: {
            create: (syncStateArray: RuntimeState[]) => {
              syncStateArray.forEach((syncState) => {
                this.syncStates.push(syncState);
              });
            },
            query: (_query: QueryOptions) => {
              return {
                fetchAll: () => {
                  return this.syncStates;
                },
              };
            },
          },
          item: (id: string) => {
            return {
              replace: (syncState: RuntimeState) => {
                const index = this.syncStates.findIndex((e) => e.id === id);
                this.syncStates[index] = syncState;
              },
            };
          },
        };
      },
    };
  }
}
