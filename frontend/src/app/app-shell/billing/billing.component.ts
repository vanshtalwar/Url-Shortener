import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { Me } from '../../api-types';
import { MeService } from '../../me.service';
import { RazorpayCheckoutService } from '../../razorpay-checkout.service';
import { ToastService } from '../../ui/toast.service';
import { PRICES, formatInr } from '../../marketing/plans';
import { apiError } from '../../api-error';

type Interval = 'monthly' | 'yearly';

@Component({
  selector: 'app-billing',
  templateUrl: './billing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingComponent {
  interval: Interval = this.route.snapshot.queryParamMap.get('interval') === 'monthly' ? 'monthly' : 'yearly';
  busy = false;
  error = '';
  confirmingCancel = false;
  readonly monthly = formatInr(PRICES.monthly);
  readonly yearly = formatInr(PRICES.yearly);
  readonly monthsFree = Math.round(12 - PRICES.yearly / PRICES.monthly);

  constructor(
    public me: MeService,
    private route: ActivatedRoute,
    private checkout: RazorpayCheckoutService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  /** Razorpay status that means the last payment didn't go through. */
  paymentProblem(me: Me): boolean {
    return me.subscription?.status === 'halted' || me.subscription?.status === 'pending';
  }

  async upgrade(me: Me): Promise<void> {
    this.busy = true;
    this.error = '';
    this.cdr.markForCheck();
    try {
      const { subscriptionId, keyId } = await firstValueFrom(this.me.startSubscription(this.interval));
      const description = this.interval === 'yearly' ? `Pro · ${this.yearly} / year` : `Pro · ${this.monthly} / month`;
      const result = await this.checkout.open({ keyId, subscriptionId, email: me.user.email, description });
      if (result) {
        await firstValueFrom(this.me.verifyPayment(result));
        this.toast.show('Welcome to Zelqit Pro');
      }
      this.me.refresh();
    } catch (err) {
      this.error = err instanceof HttpErrorResponse ? apiError(err).message : 'Could not open the payment window. Check your connection and try again.';
      if (err instanceof HttpErrorResponse && err.error?.code === 'ALREADY_PRO') this.me.refresh();
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  cancel(): void {
    this.busy = true;
    this.me.cancelSubscription().subscribe({
      next: () => {
        this.busy = false;
        this.confirmingCancel = false;
        this.toast.show('Subscription cancelled — Pro stays active until the end of the period');
        this.me.refresh();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.busy = false;
        this.error = apiError(err).message;
        this.cdr.markForCheck();
      },
    });
  }
}
