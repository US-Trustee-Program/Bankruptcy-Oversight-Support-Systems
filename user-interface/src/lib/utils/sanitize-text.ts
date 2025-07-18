import DOMPurify, { Config } from 'dompurify';
import { getAppInsights } from '../hooks/UseApplicationInsights';
import { IEventTelemetry } from '@microsoft/applicationinsights-web';
import LocalStorage from './local-storage';
import { filterToExtendedAscii } from '@common/cams/sanitization';

export const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['em', 'strong', 'p', 'ul', 'ol', 'li', 'br', 'span', 'a', 'u'],
  ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: [
    'onerror',
    'onload',
    'onclick',
    'onmouseover',
    'onmousedown',
    'onfocus',
    'onblur',
    'onkeydown',
    'onkeypress',
    'srcset',
    'src',
  ],
};

const DOMPURIFY_TEXT_ONLY_CONFIG = {
  ALLOWED_TAGS: ['#text'],
  KEEP_CONTENT: false,
};

export function sanitizeText(maybeDirty: string, configuration: Partial<Config> = {}) {
  const domPurifyConfig: Config = { ...DOMPURIFY_TEXT_ONLY_CONFIG, ...configuration };
  const clean = DOMPurify.sanitize(filterToExtendedAscii(maybeDirty), domPurifyConfig);

  if (DOMPurify.removed.length) {
    const { appInsights } = getAppInsights();
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
