import { validateObject } from '@common/cams/validation';
import { typedPhoneNumberSpec } from '@common/cams/trustees-validators';
import { TypedPhoneNumber } from '@common/cams/contact';
import { PhoneRowErrors } from './PhoneEntryList';

export function validateTypedPhones(phones: TypedPhoneNumber[]): Record<number, PhoneRowErrors> {
  const errors: Record<number, PhoneRowErrors> = {};

  phones.forEach((phone, index) => {
    const touched = !!phone.number.trim() || !!phone.extension?.trim();
    if (!touched) {
      return;
    }

    const result = validateObject(typedPhoneNumberSpec, phone);
    if (result.valid || !result.reasonMap) {
      return;
    }

    const rowErrors: PhoneRowErrors = {};
    if (result.reasonMap.type?.reasons) {
      rowErrors.type = result.reasonMap.type.reasons;
    }
    if (result.reasonMap.number?.reasons) {
      rowErrors.number = result.reasonMap.number.reasons;
    }
    if (result.reasonMap.extension?.reasons) {
      rowErrors.extension = result.reasonMap.extension.reasons;
    }
    if (Object.keys(rowErrors).length > 0) {
      errors[index] = rowErrors;
    }
  });

  return errors;
}
