const clientId = import.meta.env['CAMS_FEATURE_FLAG_CLIENT_ID'];
const useExternalProvider = clientId ? true : false;

// DECISION IS TO NOT USE CAMEL CASE FLAGS
const useCamelCaseFlagKeys = false;

export default {
  clientId,
  useExternalProvider,
  useCamelCaseFlagKeys,
} as const;
