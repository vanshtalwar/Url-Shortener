import { BUSINESS } from './business';
import { PRICES, formatInr } from './plans';

interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalPage {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const b = BUSINESS;
const contact = `${b.supportEmail}`;

/**
 * Legal text for Zelqit. Written to describe what the product actually does (see backend/README).
 * This is a starting template, not legal advice — have it reviewed before relying on it.
 */
export const LEGAL_PAGES: Record<'terms' | 'privacy' | 'refunds', LegalPage> = {
  terms: {
    title: 'Terms of Service',
    intro: `These terms apply to your use of ${b.brand}, a link-shortening and analytics service operated by ${b.legalName} ("we", "us"). By creating an account you agree to them.`,
    sections: [
      { heading: 'Your account', paragraphs: [
        'You can sign up with Google or with an email address and password. Keep your login details private; you are responsible for activity on your account.',
        'You must be at least 18 years old, or have permission from a parent or guardian, to use the service.',
      ] },
      { heading: 'Acceptable use', paragraphs: [
        'Do not use short links for phishing, malware, spam, fraud, illegal content, harassment, or to hide where a link really goes in order to mislead people.',
        'We may disable links or accounts that break these rules, or that we are legally required to remove, without notice.',
      ] },
      { heading: 'Plans and billing', paragraphs: [
        `The Free plan includes 25 new links per month and 30 days of analytics history. Pro costs ${formatInr(PRICES.monthly)} per month or ${formatInr(PRICES.yearly)} per year, in Indian rupees. Applicable taxes may be added.`,
        'Pro is a subscription billed in advance through Razorpay and renews automatically at the end of each period until you cancel. We never see or store your full card or bank details.',
        'If a renewal payment fails, Pro features become read-only until a payment succeeds or you subscribe again. Your links keep working.',
        'We may change prices with at least 30 days\' notice by email; changes apply from your next renewal.',
      ] },
      { heading: 'Cancellation and refunds', paragraphs: [
        'You can cancel at any time from the Billing page. Our Refund & Cancellation Policy explains what happens next.',
      ] },
      { heading: 'Your content', paragraphs: [
        'You keep ownership of the links and page content you create. You give us permission to store and process it to run the service.',
      ] },
      { heading: 'Availability', paragraphs: [
        'We work to keep the service running but do not guarantee it will always be available or error-free. Redirects may occasionally be slow or briefly unavailable.',
      ] },
      { heading: 'Liability', paragraphs: [
        `To the extent the law allows, ${b.brand} is provided "as is", and our total liability for any claim is limited to the amount you paid us in the 3 months before it arose.`,
      ] },
      { heading: 'Ending your use', paragraphs: [
        'You can stop using the service at any time. To delete your account and data, email us. We may suspend or close accounts that break these terms.',
      ] },
      { heading: 'Changes and governing law', paragraphs: [
        'We may update these terms; we will post the new version here and update the date above. Continuing to use the service means you accept the changes.',
        `These terms are governed by the laws of India. Disputes are subject to the courts of ${b.jurisdictionCity}.`,
      ] },
      { heading: 'Contact', paragraphs: [`Questions about these terms: ${contact}. Postal address: ${b.address}.`] },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    intro: `This policy explains what ${b.brand} (operated by ${b.legalName}) collects, why, and the choices you have. We designed the service to collect as little as it needs.`,
    sections: [
      { heading: 'Account information', paragraphs: [
        'Your email address; a securely hashed password if you sign up with email (we never store the password itself); your Google account ID if you sign in with Google.',
      ] },
      { heading: 'Your links', paragraphs: [
        'The destinations, aliases, expiry dates, folders, tags, UTM presets and link-in-bio page you create. Link passwords are stored only as secure hashes.',
      ] },
      { heading: 'Click analytics', paragraphs: [
        'When someone opens a short link we record: the time; the referring website\'s domain (not the full page address); browser, operating system and device type; whether it looks like a bot; an approximate country and city; and a visitor identifier.',
        'The visitor identifier is a salted one-way hash of the network address and browser. Raw IP addresses are never stored.',
        'Approximate location uses GeoLite2 data created by MaxMind, available from https://www.maxmind.com. The lookup happens on our server.',
      ] },
      { heading: 'Payments', paragraphs: [
        'Payments are handled by Razorpay. We receive your subscription status and payment references, never full card or bank details. Razorpay\'s own privacy policy applies to the data you give them.',
      ] },
      { heading: 'In your browser', paragraphs: [
        'We store your sign-in token and theme choice in your browser\'s local storage. We do not use advertising or third-party tracking cookies. Google\'s sign-in button is loaded from Google when you use it.',
      ] },
      { heading: 'Service providers', paragraphs: [
        'We use: MongoDB Atlas (database), Render (API hosting), Vercel (website hosting), Google (sign-in and sending email through Gmail), and Razorpay (payments). They process data only to provide their service to us.',
      ] },
      { heading: 'How long we keep data', paragraphs: [
        'We keep your data while your account is open. On the Free plan, analytics older than 30 days are hidden from you but kept, and become visible again if you upgrade. When you ask us to delete your account, we delete your links and their analytics.',
      ] },
      { heading: 'Your rights', paragraphs: [
        `Under India's Digital Personal Data Protection Act, 2023 you may ask to access, correct or delete your personal data, and to withdraw consent. Email ${contact} and we will respond as the law requires.`,
      ] },
      { heading: 'Changes', paragraphs: ['We will post any changes here and update the date above.'] },
      { heading: 'Contact', paragraphs: [`Privacy questions: ${contact}. Postal address: ${b.address}.`] },
    ],
  },

  refunds: {
    title: 'Refund & Cancellation Policy',
    intro: `This policy covers ${b.brand} Pro subscriptions (${formatInr(PRICES.monthly)} per month or ${formatInr(PRICES.yearly)} per year) paid through Razorpay.`,
    sections: [
      { heading: 'Cancel any time', paragraphs: [
        'You can cancel your Pro subscription at any time from the Billing page in your dashboard. No further payments will be taken.',
        'After you cancel, Pro stays active until the end of the period you have already paid for. Then your account moves to the Free plan.',
      ] },
      { heading: 'No refunds', paragraphs: [
        'Payments are not refundable, including for unused time in the current month or year, because you keep full Pro access until the end of that period.',
        'If you were charged twice for the same period because of a technical error, contact us and we will refund the duplicate charge to the original payment method.',
      ] },
      { heading: 'What happens to your data', paragraphs: [
        'Cancelling never deletes your links: they keep redirecting. Pro-only settings (folders, tags, A/B splits, UTM presets, link-in-bio) become read-only until you upgrade again, and analytics older than 30 days are hidden but kept.',
      ] },
      { heading: 'Failed payments', paragraphs: [
        'If Razorpay cannot collect a renewal, Pro features become read-only. You can subscribe again at any time from the Billing page.',
      ] },
      { heading: 'Contact', paragraphs: [`Billing questions: ${contact}. Postal address: ${b.address}.`] },
    ],
  },
};
