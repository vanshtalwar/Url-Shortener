import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { followSectionPalette, startAfterFirstPaint } from '../experience-loader';
import { PLAN_FEATURES, PRICES, formatInr } from './plans';

type Interval = 'monthly' | 'yearly';

@Component({
  selector: 'app-pricing',
  templateUrl: './pricing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingComponent implements AfterViewInit, OnDestroy {
  interval: Interval = 'yearly';
  readonly features = PLAN_FEATURES;
  readonly monthly = formatInr(PRICES.monthly);
  readonly yearly = formatInr(PRICES.yearly);
  readonly yearlyPerMonth = formatInr(Math.round(PRICES.yearly / 12));
  readonly monthsFree = Math.round(12 - PRICES.yearly / PRICES.monthly);

  readonly faqs = [
    { q: 'Can I switch between monthly and yearly?', a: 'Yes. Cancel your current plan and subscribe to the other one when the paid period ends; you keep Pro until then.' },
    { q: 'Which payment methods can I use?', a: 'Razorpay handles payment: UPI, cards and the other methods Razorpay offers for subscriptions in India.' },
    { q: 'Do you offer refunds?', a: 'Payments are not refundable, but you can cancel any time and keep Pro until the end of the paid period. See the Refund & Cancellation Policy.' },
    { q: 'What happens to my links if I stop paying?', a: 'They keep working. Pro-only settings become read-only and analytics older than 30 days are hidden until you upgrade again.' },
  ];

  private stopExperience?: () => void;
  private stopPalette?: () => void;

  constructor(public auth: AuthService, private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  /** Fixed cream palette; the 3D link (its own chunk) settles above the Pro card after first paint. */
  ngAfterViewInit(): void {
    const page = this.host.nativeElement;
    this.stopPalette = followSectionPalette(this.zone, page);
    this.stopExperience = startAfterFirstPaint(this.zone, () => import('../experience/pricing-page'), ({ startPricing }) => startPricing(page));
  }

  ngOnDestroy(): void {
    this.stopExperience?.();
    this.stopPalette?.();
  }

  /** "✓" / "—" / a limit string, for the comparison table. Pure. */
  cell(value: boolean | string): string {
    return typeof value === 'string' ? value : value ? '✓' : '—';
  }
}
