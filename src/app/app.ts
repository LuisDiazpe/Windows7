import { Component, signal } from '@angular/core';
import { DesktopComponent } from './presentation/desktop/components/desktop.component';
import { LoginScreenComponent } from './presentation/desktop/components/login-screen.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DesktopComponent, LoginScreenComponent],
  template: `
    @if (!isLoggedIn()) {
      <app-login-screen (loggedIn)="onLoggedIn()" />
    } @else {
      <app-desktop />
    }
  `,
})
export class App {
  isLoggedIn = signal(false);

  onLoggedIn(): void {
    this.isLoggedIn.set(true);
  }
}
