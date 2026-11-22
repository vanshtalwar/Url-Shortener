import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthService } from '../auth/auth.service';

/** Public site shell: glass header with nav, footer with legal links and MaxMind attribution. */
@Component({
  selector: 'app-marketing-layout',
  templateUrl: './marketing-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingLayoutComponent {
  menuOpen = false;
  readonly year = new Date().getFullYear();
  readonly nav = [
    { label: 'Features', path: '/features' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'Guides', path: '/blog' },
    { label: 'About', path: '/about' },
  ];
  readonly footer = [
    { title: 'Product', links: [{ label: 'Features', path: '/features' }, { label: 'Pricing', path: '/pricing' }, { label: 'Guides', path: '/blog' }] },
    { title: 'Company', links: [{ label: 'About', path: '/about' }, { label: 'Contact', path: '/contact' }] },
    {
      title: 'Legal',
      links: [
        { label: 'Terms', path: '/legal/terms' },
        { label: 'Privacy', path: '/legal/privacy' },
        { label: 'Refunds & cancellation', path: '/legal/refunds' },
      ],
    },
  ];

  constructor(public auth: AuthService) {}
}
