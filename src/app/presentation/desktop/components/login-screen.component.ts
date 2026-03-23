import { Component, inject, signal, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemSettingsService } from '../../../infrastructure/state/system-settings.service';

type LoginState = 'lock' | 'login' | 'logging-in';

@Component({
  selector: 'app-login-screen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-screen.component.html',
  styleUrl: './login-screen.component.css',
})
export class LoginScreenComponent implements OnInit, OnDestroy {
  @Output() loggedIn = new EventEmitter<void>();

  readonly sys = inject(SystemSettingsService);

  state = signal<LoginState>('lock');
  password = signal('');
  error = signal('');
  currentTime = signal('');
  currentDate = signal('');
  showPassword = signal(false);

  private clockInterval?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  private updateClock(): void {
    const now = new Date();
    this.currentTime.set(now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    }));
    this.currentDate.set(now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    }));
  }

  unlock(): void {
    if (this.state() === 'lock') this.state.set('login');
  }

  tryLogin(): void {
    const correctPassword = this.sys.settings().password;
    if (!correctPassword || this.password() === correctPassword) {
      this.state.set('logging-in');
      this.error.set('');
      setTimeout(() => this.loggedIn.emit(), 1200);
    } else {
      this.error.set('The password is incorrect. Please try again.');
      this.password.set('');
    }
  }

  backToLock(): void {
    this.state.set('lock');
    this.password.set('');
    this.error.set('');
  }

  shutdownSystem(): void {
    document.body.style.transition = 'opacity 1s ease';
    document.body.style.opacity = '0';
    setTimeout(() => {
      document.body.innerHTML = `
        <div style="width:100vw;height:100vh;background:#000;display:flex;align-items:center;justify-content:center;">
          <div style="color:white;font-family:Segoe UI;font-size:18px;">Shutting down...</div>
        </div>
      `;
    }, 1000);
  }
}
