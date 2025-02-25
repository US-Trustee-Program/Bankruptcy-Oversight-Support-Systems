export class MockLocalStorage {
  map = new Map<string, string>();
  length = 0;

  getItem = (key: string) => this.map.get(key) ?? null;
  setItem = (key: string, value: string) => {
    this.map.set(key, value);
    this.length = this.map.size;
  };
  removeItem = (key: string) => {
    this.map.delete(key);
    this.length = this.map.size;
  };
  clear = () => {
    this.map.clear();
    this.length = this.map.size;
  };
  key = (index: number) => {
    const _key = [...this.map.keys()][index] || null;
    return _key;
  };
}
