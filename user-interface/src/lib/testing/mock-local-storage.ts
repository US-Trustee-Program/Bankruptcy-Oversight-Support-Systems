export const mockLocalStorage = {
  store: new Map<string, string>(),

  setItem(key: string, value: string): void {
    mockLocalStorage.store.set(key, value);
  },

  getItem(key: string): string | null {
    return mockLocalStorage.store.get(key) ?? null;
  },

  removeItem(key: string): void {
    mockLocalStorage.store.delete(key);
  },

  clear(): void {
    mockLocalStorage.store.clear();
  },

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  },

  get length(): number {
    return mockLocalStorage.store.size;
  },
};
