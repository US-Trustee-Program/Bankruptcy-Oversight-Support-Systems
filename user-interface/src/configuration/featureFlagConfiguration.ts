const clientId = import.meta.env['CAMS_FEATURE_FLAG_CLIENT_ID'];
const useExternalProvider = !!clientId;

// DECISION IS TO NOT USE CAMEL CASE FLAGS
const useCamelCaseFlagKeys = false;

export const getFeatureFlagConfiguration = () => {
  return {
    clientId,
    useExternalProvider,
    useCamelCaseFlagKeys,
  } as const;
};
