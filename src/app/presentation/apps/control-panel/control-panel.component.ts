import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemSettingsService, Wallpaper } from '../../../infrastructure/state/system-settings.service';

type ActivePanel = null | 'display' | 'sound' | 'datetime' | 'accounts';

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './control-panel.component.html',
  styleUrl: './control-panel.component.css',
})
export class ControlPanelComponent {
  readonly sys = inject(SystemSettingsService);

  activePanel = signal<ActivePanel>(null);
  selectedWallpaper = signal<Wallpaper>(this.sys.wallpaper());
  tempVolume = signal(this.sys.volume());
  tempUsername = signal(this.sys.username());
  tempTimezone = signal(this.sys.timezone());
  tempAccent = signal(this.sys.accentColor());
  tempPassword = signal('');
  tempNewPassword = signal('');

  readonly items = [
    { id: 'display',   name: 'Display',       desc: 'Change wallpaper and colors',      color: '#4a90d9', icon: 'icon-display' },
    { id: 'sound',     name: 'Sound',          desc: 'Adjust system volume',             color: '#50a0d0', icon: 'icon-sound' },
    { id: 'datetime',  name: 'Date and Time',  desc: 'Set date, time and time zone',     color: '#4090c0', icon: 'icon-clock' },
    { id: 'accounts',  name: 'User Accounts',  desc: 'Change account settings',          color: '#9050d0', icon: 'icon-user' },
    { id: 'network',   name: 'Network',        desc: 'View network status and tasks',    color: '#e09020', icon: 'icon-network' },
    { id: 'programs',  name: 'Programs',       desc: 'Uninstall a program',              color: '#d05050', icon: 'icon-programs' },
    { id: 'security',  name: 'Security Center',desc: 'Check security status',            color: '#50a050', icon: 'icon-security' },
    { id: 'firewall',  name: 'Firewall',       desc: 'Check firewall status',            color: '#d07020', icon: 'icon-firewall' },
    { id: 'mouse',     name: 'Mouse',          desc: 'Change mouse settings',            color: '#808080', icon: 'icon-mouse' },
    { id: 'keyboard',  name: 'Keyboard',       desc: 'Change keyboard settings',         color: '#606060', icon: 'icon-keyboard' },
    { id: 'system',    name: 'System',         desc: 'View basic info about your computer', color: '#4a70b0', icon: 'icon-system' },
    { id: 'update',    name: 'Windows Update', desc: 'Turn automatic updating on or off', color: '#4a90d9', icon: 'icon-update' },
  ];
  readonly activePanelName = computed(() => {
    if (!this.activePanel()) return 'Control Panel';
    return this.items.find(i => i.id === this.activePanel())?.name ?? 'Control Panel';
  });

  openPanel(id: string): void {
    if (['display', 'sound', 'datetime', 'accounts'].includes(id)) {
      this.activePanel.set(id as ActivePanel);
      this.selectedWallpaper.set(this.sys.wallpaper());
      this.tempVolume.set(this.sys.volume());
      this.tempUsername.set(this.sys.username());
      this.tempTimezone.set(this.sys.timezone());
      this.tempAccent.set(this.sys.accentColor());
    } else {
      alert(`${this.items.find(i => i.id === id)?.name} is not yet implemented.`);
    }
  }

  closePanel(): void { this.activePanel.set(null); }

  // Display
  applyWallpaper(): void {
    this.sys.setWallpaper(this.selectedWallpaper());
    this.sys.setAccentColor(this.tempAccent());
    this.closePanel();
  }

  // Sound
  onVolumeChange(val: string): void { this.tempVolume.set(+val); }
  applySound(): void {
    this.sys.setVolume(this.tempVolume());
    this.closePanel();
  }

  // Date and Time
  applyDateTime(): void {
    this.sys.setTimezone(this.tempTimezone());
    this.closePanel();
  }

  // User Accounts
  applyAccounts(): void {
    const name = this.tempUsername().trim();
    if (name) this.sys.setUsername(name);
    if (this.tempNewPassword().trim()) {
      this.sys.setPassword(this.tempNewPassword());
    }
    this.closePanel();
  }

  getVolumeIcon(): string {
    const v = this.tempVolume();
    if (v === 0) return 'muted';
    if (v < 40) return 'low';
    if (v < 75) return 'mid';
    return 'high';
  }
}
