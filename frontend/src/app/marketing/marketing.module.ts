import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { UiModule } from '../ui/ui.module';
import { MarketingLayoutComponent } from './marketing-layout.component';
import { LandingComponent } from './landing.component';
import { FeaturesComponent } from './features.component';
import { PricingComponent } from './pricing.component';
import { AboutComponent } from './about.component';
import { ContactComponent } from './contact.component';
import { LegalComponent } from './legal.component';
import { BlogIndexComponent } from './blog-index.component';
import { BlogArticleComponent } from './blog-article.component';

const routes: Routes = [
  {
    path: '',
    component: MarketingLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', component: LandingComponent, title: 'Zelqit — short links with real analytics' },
      { path: 'features', component: FeaturesComponent, title: 'Features · Zelqit' },
      { path: 'pricing', component: PricingComponent, title: 'Pricing · Zelqit' },
      { path: 'about', component: AboutComponent, title: 'About · Zelqit' },
      { path: 'contact', component: ContactComponent, title: 'Contact · Zelqit' },
      { path: 'blog', component: BlogIndexComponent, title: 'Guides · Zelqit' },
      { path: 'blog/:slug', component: BlogArticleComponent }, // title set from the guide
      { path: 'legal/terms', component: LegalComponent, data: { page: 'terms' }, title: 'Terms of Service · Zelqit' },
      { path: 'legal/privacy', component: LegalComponent, data: { page: 'privacy' }, title: 'Privacy Policy · Zelqit' },
      { path: 'legal/refunds', component: LegalComponent, data: { page: 'refunds' }, title: 'Refund & Cancellation · Zelqit' },
    ],
  },
];

@NgModule({
  declarations: [
    MarketingLayoutComponent, LandingComponent, FeaturesComponent, PricingComponent, AboutComponent, ContactComponent, LegalComponent,
    BlogIndexComponent, BlogArticleComponent,
  ],
  imports: [CommonModule, FormsModule, UiModule, RouterModule.forChild(routes)],
})
export class MarketingModule {}
