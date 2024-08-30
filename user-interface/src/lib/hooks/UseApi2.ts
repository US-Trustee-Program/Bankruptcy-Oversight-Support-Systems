import * as Api2Module from '../models/api2';

export function useApi2() {
  return Api2Module.Api2;
}

// These exports are here for legacy support. These can be removed once these are no longer imported from the hook source file.
export const Api2 = Api2Module.Api2;
export default Api2;
