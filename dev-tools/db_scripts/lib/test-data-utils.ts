/**
 * Shared utilities for test data generation across scenario scripts
 */

import { faker } from '@faker-js/faker';

/**
 * Generates a fake US phone number in the format ###-###-####
 * Matches the PHONE_REGEX pattern required for clickable tel: links in the UI
 *
 * @returns A phone number string in format ###-###-####
 * @example
 * fakeUsPhoneNumber() // "212-555-0123"
 */
export function fakeUsPhoneNumber(): string {
  return `${faker.string.numeric(3)}-${faker.string.numeric(3)}-${faker.string.numeric(4)}`;
}
