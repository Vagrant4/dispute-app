import { describe, expect, it } from 'vitest';
import { isValidInternationalPhone } from '../src/utils/phone.js';

describe('international phone validation', () => {
  it.each([
    '+639171234567', '+6590000000', '+60123456789', '+14155552671', '+447911123456',
    '+919876543210', '+61412345678', '+27821234567', '+5511987654321', '+2348031234567'
  ])('accepts valid E.164 number %s', (phone) => {
    expect(isValidInternationalPhone(phone)).toBe(true);
  });

  it.each(['+9991234567', '+650000', '+65 123'])('rejects invalid international phone %s', (phone) => {
    expect(isValidInternationalPhone(phone)).toBe(false);
  });
});
