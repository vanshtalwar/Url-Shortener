import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthInterceptor } from './auth/auth.interceptor';
import { LoginComponent } from './pages/login/login.component';
import { LinksComponent } from './pages/links/links.component';
import { LinkCreateFormComponent } from './pages/links/link-create-form.component';
import { QrPanelComponent } from './pages/links/qr-panel.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    LinksComponent,
    LinkCreateFormComponent,
    QrPanelComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
