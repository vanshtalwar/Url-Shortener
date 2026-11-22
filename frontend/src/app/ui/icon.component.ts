import { ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, Renderer2 } from '@angular/core';
import {
  ArrowRight, BarChart3, Check, ChevronDown, Copy, CreditCard, ExternalLink, Folder, Globe, Link2, Loader2, Lock,
  LogOut, Menu, Monitor, Moon, Pencil, Plus, QrCode, Search, Settings, Shield, Sparkles, Sun, Tag, Trash2, UserRound, X, Zap,
} from 'lucide';

type IconNode = readonly [string, Record<string, string | number>, ReadonlyArray<readonly [string, Record<string, string | number>]>?];

// Only icons listed here end up in the bundle.
const ICONS = {
  'arrow-right': ArrowRight, chart: BarChart3, check: Check, 'chevron-down': ChevronDown, copy: Copy,
  'credit-card': CreditCard, external: ExternalLink, folder: Folder, globe: Globe, link: Link2, loader: Loader2,
  lock: Lock, logout: LogOut, menu: Menu, monitor: Monitor, moon: Moon, edit: Pencil, plus: Plus, qr: QrCode,
  search: Search, settings: Settings, shield: Shield, sparkles: Sparkles, sun: Sun, tag: Tag, trash: Trash2, user: UserRound, x: X, zap: Zap,
} as const;

export type IconName = keyof typeof ICONS;

/** Lucide icon as inline SVG. Decorative (aria-hidden) unless `label` is given. */
@Component({
  selector: 'z-icon',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
})
export class IconComponent implements OnChanges {
  @Input() name!: IconName;
  @Input() size = 18;
  @Input() label?: string;

  constructor(private host: ElementRef<HTMLElement>, private renderer: Renderer2) {}

  ngOnChanges(): void {
    const [, attrs, children = []] = ICONS[this.name] as unknown as IconNode;
    const svg = this.renderer.createElement('svg', 'svg') as SVGElement;
    for (const [key, value] of Object.entries({ ...attrs, width: this.size, height: this.size })) {
      this.renderer.setAttribute(svg, key, String(value));
    }
    if (this.label) {
      this.renderer.setAttribute(svg, 'role', 'img');
      this.renderer.setAttribute(svg, 'aria-label', this.label);
    } else {
      this.renderer.setAttribute(svg, 'aria-hidden', 'true');
    }
    for (const [tag, childAttrs] of children) {
      const child = this.renderer.createElement(tag, 'svg');
      for (const [key, value] of Object.entries(childAttrs)) this.renderer.setAttribute(child, key, String(value));
      this.renderer.appendChild(svg, child);
    }
    this.host.nativeElement.replaceChildren(svg);
  }
}
