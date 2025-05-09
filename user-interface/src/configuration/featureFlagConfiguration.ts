import getAppConfiguration from '@/configuration/appConfiguration';

// DECISION IS TO NOT USE CAMEL CASE FLAGS
const useCamelCaseFlagKeys = false;

export const getFeatureFlagConfiguration = () => {
  const clientId = getAppConfiguration().featureFlagClientId ?? '';
  const useExternalProvider = !!clientId;
  return {
    clientId,
    useExternalProvider,
    useCamelCaseFlagKeys,
  } as const;
};
