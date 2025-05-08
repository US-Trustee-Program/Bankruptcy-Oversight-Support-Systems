import getAppConfiguration from '@/configuration/appConfiguration';

const clientId = getAppConfiguration().featureFlagClientId;
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
