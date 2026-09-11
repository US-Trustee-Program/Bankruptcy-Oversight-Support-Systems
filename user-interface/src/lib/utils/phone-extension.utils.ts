import { MAX_EXTENSION_LENGTH, PhoneNumber } from '@common/cams/contact';

export function sanitizeExtensionInput(rawValue: string): string {
  return rawValue.replace(/\D/g, '').slice(0, MAX_EXTENSION_LENGTH);
}

export function formatPhoneWithExtension(phone?: PhoneNumber): string | undefined {
  if (!phone) return undefined;
  return `${phone.number}${phone.extension ? ` x${phone.extension}` : ''}`;
}
