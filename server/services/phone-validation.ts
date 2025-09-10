/**
 * Phone Number Validation Utilities
 * Implements unified phone validation according to Kenyan standards (2547XXXXXXXX format)
 */

export class PhoneValidationError extends Error {
  constructor(message: string, public code: string = 'INVALID_PHONE') {
    super(message);
    this.name = 'PhoneValidationError';
  }
}

/**
 * Validates and formats Kenyan phone numbers to 2547XXXXXXXX format
 * Supports various input formats:
 * - 0712345678 -> 254712345678
 * - +254712345678 -> 254712345678  
 * - 254712345678 -> 254712345678
 * - 712345678 -> 254712345678
 */
export function validateAndFormatKenyanPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw new PhoneValidationError('Phone number is required', 'PHONE_REQUIRED');
  }

  // Clean the phone number - remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle different input formats
  if (cleaned.startsWith('254')) {
    // Already in international format (254XXXXXXXXX)
    cleaned = cleaned;
  } else if (cleaned.startsWith('0')) {
    // Remove leading 0 and add 254 (0712345678 -> 254712345678)
    cleaned = '254' + cleaned.substring(1);
  } else if (cleaned.length === 9) {
    // Add country code for 9-digit numbers (712345678 -> 254712345678)
    cleaned = '254' + cleaned;
  } else {
    throw new PhoneValidationError('Invalid phone number format', 'INVALID_FORMAT');
  }

  // Validate final format: should be 12 digits starting with 254, but be flexible with 11-digit variations
  if (cleaned.length < 11 || cleaned.length > 12) {
    throw new PhoneValidationError('Phone number must be 11-12 digits in format 254XXXXXXXXX', 'INVALID_LENGTH');
  }

  // Handle 11-digit numbers starting with 254 (missing one digit)
  if (cleaned.length === 11 && cleaned.startsWith('254')) {
    // This might be a truncated number, insert '7' after '254' to form 2547XXXXXXXX
    cleaned = cleaned.substring(0, 3) + '7' + cleaned.substring(3);
    console.log(`📱 Fixed 11-digit phone: ${phone} -> ${cleaned}`);
    
    // Validate the resulting number still has a valid prefix
    const prefix = cleaned.substring(0, 6);
    const validKenyanPrefixes = ['254701', '254702', '254703', '254704', '254705', '254706', '254707', '254708', '254709',
                                 '254710', '254711', '254712', '254713', '254714', '254715', '254716', '254717', '254718', '254719',
                                 '254720', '254721', '254722', '254723', '254724', '254725', '254726', '254727', '254728', '254729',
                                 '254730', '254731', '254732', '254733', '254734', '254735', '254736', '254737', '254738', '254739',
                                 '254740', '254741', '254742', '254743', '254744', '254745', '254746', '254747', '254748', '254749',
                                 '254750', '254751', '254752', '254753', '254754', '254755', '254756', '254757', '254758', '254759',
                                 '254768', '254769', '254790', '254791', '254792', '254793', '254794', '254795', '254796', '254797', '254798', '254799'];
    
    const isValidPrefix = validKenyanPrefixes.some(validPrefix => cleaned.startsWith(validPrefix));
    if (!isValidPrefix) {
      throw new PhoneValidationError('Phone number appears incomplete and cannot be safely normalized', 'INVALID_PREFIX');
    }
  }

  if (!cleaned.startsWith('254')) {
    throw new PhoneValidationError('Phone number must start with Kenya country code 254', 'INVALID_COUNTRY_CODE');
  }

  // Validate that it follows Kenyan mobile number patterns
  const validKenyanPrefixes = ['254701', '254702', '254703', '254704', '254705', '254706', '254707', '254708', '254709',
                               '254710', '254711', '254712', '254713', '254714', '254715', '254716', '254717', '254718', '254719',
                               '254720', '254721', '254722', '254723', '254724', '254725', '254726', '254727', '254728', '254729',
                               '254730', '254731', '254732', '254733', '254734', '254735', '254736', '254737', '254738', '254739',
                               '254740', '254741', '254742', '254743', '254744', '254745', '254746', '254747', '254748', '254749',
                               '254750', '254751', '254752', '254753', '254754', '254755', '254756', '254757', '254758', '254759',
                               '254768', '254769', '254790', '254791', '254792', '254793', '254794', '254795', '254796', '254797', '254798', '254799'];

  const prefix = cleaned.substring(0, 6); // Get first 6 digits (254 + 3 digit network code)
  const isValidPrefix = validKenyanPrefixes.some(validPrefix => cleaned.startsWith(validPrefix));

  if (!isValidPrefix) {
    throw new PhoneValidationError('Invalid Kenyan mobile number prefix', 'INVALID_PREFIX');
  }

  console.log(`📱 Phone validated: ${phone} -> ${cleaned}`);
  return cleaned;
}

/**
 * Format phone number for display purposes
 * 254712345678 -> +254 712 345 678
 */
export function formatPhoneForDisplay(phone: string): string {
  const validated = validateAndFormatKenyanPhone(phone);
  return `+${validated.substring(0, 3)} ${validated.substring(3, 6)} ${validated.substring(6, 9)} ${validated.substring(9)}`;
}

/**
 * Batch validate multiple phone numbers
 */
export function validatePhoneNumbers(phones: string[]): { valid: string[], invalid: { phone: string, error: string }[] } {
  const valid: string[] = [];
  const invalid: { phone: string, error: string }[] = [];

  for (const phone of phones) {
    try {
      const validatedPhone = validateAndFormatKenyanPhone(phone);
      valid.push(validatedPhone);
    } catch (error: any) {
      invalid.push({
        phone,
        error: error.message || 'Unknown validation error'
      });
    }
  }

  return { valid, invalid };
}

/**
 * Check if phone number is valid without throwing errors
 */
export function isValidKenyanPhone(phone: string): boolean {
  try {
    validateAndFormatKenyanPhone(phone);
    return true;
  } catch {
    return false;
  }
}