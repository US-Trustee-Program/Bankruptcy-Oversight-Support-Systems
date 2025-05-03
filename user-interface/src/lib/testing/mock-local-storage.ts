export const mockLocalStorage = {
  clear(): void {
    mockLocalStorage.store.clear();
  },

  getItem(key: string): null | string {
    return mockLocalStorage.store.get(key) ?? null;
  },

  key(index: number): null | string {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  },

  get length(): number {
    return mockLocalStorage.store.size;
  },

  removeItem(key: string): void {
    mockLocalStorage.store.delete(key);
  },

  setItem(key: string, value: string): void {
    mockLocalStorage.store.set(key, value);
  },

  store: new Map<string, string>(),
};
