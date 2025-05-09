import getAppConfiguration from '@/configuration/appConfiguration';

export const getFeatureFlagConfiguration = () => {
  const clientId = getAppConfiguration().featureFlagClientId ?? '';
  return {
    clientId,
    useExternalProvider: !!clientId,
    useCamelCaseFlagKeys: false,
  } as const;
};
