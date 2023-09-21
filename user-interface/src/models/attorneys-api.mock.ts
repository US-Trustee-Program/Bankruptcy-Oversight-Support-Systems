export default class MockAttorneysApi {
  public static async getAttorneys() {
    console.log('mock is called');
    return Promise.resolve([]);
  }
}
