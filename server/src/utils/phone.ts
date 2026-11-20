import { isValidPhoneNumber } from 'libphonenumber-js';

export function isValidInternationalPhone(value: string): boolean {
  const phone = value.trim();
  return isValidPhoneNumber(phone) || /^\d{8}$/.test(phone);
}
