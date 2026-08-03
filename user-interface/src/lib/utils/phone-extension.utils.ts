import { MAX_EXTENSION_LENGTH } from '@common/cams/contact';

export function sanitizeExtensionInput(rawValue: string): string {
  return rawValue.replace(/\D/g, '').slice(0, MAX_EXTENSION_LENGTH);
}
