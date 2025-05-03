import { IEventTelemetry } from '@microsoft/applicationinsights-web';
import DOMPurify, { Config } from 'dompurify';

import { useAppInsights } from '../hooks/UseApplicationInsights';
import LocalStorage from './local-storage';

// TODO: This is going to have to be a JSON string retrieved from the environment.
let defaultConfiguration: Partial<Config>;

try {
  defaultConfiguration = JSON.parse(import.meta.env['SANITIZE_CONFIG']);
} catch {
  defaultConfiguration = {
    ALLOWED_TAGS: ['#text'],
    KEEP_CONTENT: false,
  };
}

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
