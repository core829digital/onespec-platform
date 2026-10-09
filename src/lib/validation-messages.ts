import type { ValidationCode } from "@/shared/validation";

/** Key (in the `errors` namespace) of the message for a validation code, so forms and server errors read the same. */
export const VALIDATION_ERROR_KEY: Record<ValidationCode, string> = {
  REQUIRED: "validationRequired",
  TOO_SHORT: "validationTooShort",
  TOO_LONG: "validationTooLong",
  INVALID_CHARS: "validationInvalidChars",
  VAT_FORMAT: "validationVatFormat",
  VAT_CHECKSUM: "validationVatChecksum",
  VAT_PREFIX: "validationVatPrefix",
  POSTAL_FORMAT: "validationPostalFormat",
  PHONE_FORMAT: "validationPhoneFormat",
  EMAIL_FORMAT: "validationEmailFormat",
  URL_FORMAT: "validationUrlFormat",
  COUNTRY_UNSUPPORTED: "validationCountryUnsupported",
  BIRTHDATE_FORMAT: "validationBirthdate",
  UNDERAGE: "validationUnderage",
  PASSWORD_WEAK: "validationPasswordWeak",
  PASSWORD_TOO_LONG: "validationPasswordTooLong",
  DPA_REQUIRED: "validationDpaRequired",
  TERMS_REQUIRED: "validationTermsRequired",
};
