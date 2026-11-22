import { Injectable, NgZone } from '@angular/core';

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

/** What Razorpay Checkout returns after a successful subscription payment. */
interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface CheckoutOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill: { email: string };
  theme: { color: string };
  handler: (response: RazorpaySuccess) => void;
  modal: { ondismiss: () => void };
}

declare const Razorpay: new (options: CheckoutOptions) => { open(): void };

/** Loads Razorpay Checkout once and opens it; callbacks come back inside Angular's zone. */
@Injectable({ providedIn: 'root' })
export class RazorpayCheckoutService {
  private ready?: Promise<void>;

  constructor(private zone: NgZone) {}

  async open(options: { keyId: string; subscriptionId: string; email: string; description: string }): Promise<RazorpaySuccess | null> {
    await this.load();
    return new Promise((resolve) => {
      new Razorpay({
        key: options.keyId,
        subscription_id: options.subscriptionId,
        name: 'Zelqit',
        description: options.description,
        prefill: { email: options.email },
        theme: { color: '#7c3aed' },
        handler: (response) => this.zone.run(() => resolve(response)),
        modal: { ondismiss: () => this.zone.run(() => resolve(null)) }, // closed without paying
      }).open();
    });
  }

  private load(): Promise<void> {
    this.ready ??= new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        this.ready = undefined; // allow a retry
        reject(new Error('Could not load Razorpay Checkout'));
      };
      document.head.appendChild(script);
    });
    return this.ready;
  }
}
