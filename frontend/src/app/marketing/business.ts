/**
 * Business details shown on Contact, Terms, Privacy and Refunds (Razorpay reviews these pages).
 * ⚠️ PLACEHOLDERS — replace every [BRACKETED] value before applying for Razorpay live mode.
 */
export const BUSINESS = {
  brand: 'Zelqit',
  legalName: '[LEGAL NAME]', // e.g. your name (sole proprietor) or registered company name
  address: '[ADDRESS LINE 1], [CITY], [STATE] [PIN CODE], India',
  supportEmail: '[SUPPORT EMAIL]',
  jurisdictionCity: '[CITY]', // courts for disputes under the Terms
  lastUpdated: '22 November 2026',
} as const;
