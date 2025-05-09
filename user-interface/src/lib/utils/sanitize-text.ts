import DOMPurify, { Config } from 'dompurify';
import { useAppInsights } from '../hooks/UseApplicationInsights';
import { IEventTelemetry } from '@microsoft/applicationinsights-web';
import LocalStorage from './local-storage';

const defaultConfiguration = {
  ALLOWED_TAGS: ['#text'],
  KEEP_CONTENT: false,
};

export function sanitizeText(maybeDirty: string, configuration: Partial<Config> = {}) {
  const domPurifyConfig: Config = { ...defaultConfiguration, ...configuration };
  const clean = DOMPurify.sanitize(maybeDirty, domPurifyConfig);

  if (DOMPurify.removed.length) {
    const { appInsights } = useAppInsights();
    const event: IEventTelemetry = {
      name: 'Malicious text entry found',
      properties: {
        user: LocalStorage.getSession()?.user || { name: 'UNKNOWN' },
      },
    };
    appInsights.trackEvent(event);
  }

  return clean;
}
