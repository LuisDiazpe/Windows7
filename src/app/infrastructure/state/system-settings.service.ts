import { Injectable, signal, computed } from '@angular/core';

export type WallpaperType = 'gradient' | 'solid' | 'pattern';

export interface Wallpaper {
  id: string;
  name: string;
  type: WallpaperType;
  value: string;
}

export interface SystemSettings {
  username: string;
  volume: number;
  muted: boolean;
  timezone: string;
  wallpaper: Wallpaper;
  accentColor: string;
}

@Injectable({ providedIn: 'root' })
export class SystemSettingsService {
  readonly wallpapers: Wallpaper[] = [
    { id: 'win7-default', name: 'Windows 7', type: 'gradient', value: 'radial-gradient(ellipse at center, #2b7fc1 0%, #1a5fa0 50%, #0d3d6e 100%)' },
    { id: 'aurora', name: 'Aurora', type: 'gradient', value: 'linear-gradient(135deg, #0d3d6e 0%, #1a7a4a 40%, #0d3d6e 100%)' },
    { id: 'sunset', name: 'Sunset', type: 'gradient', value: 'linear-gradient(180deg, #ff6b35 0%, #f7c59f 40%, #efefd0 100%)' },
    { id: 'ocean', name: 'Ocean', type: 'gradient', value: 'linear-gradient(180deg, #006994 0%, #0099cc 50%, #00ccff 100%)' },
    { id: 'forest', name: 'Forest', type: 'gradient', value: 'linear-gradient(180deg, #1a472a 0%, #2d6a4f 50%, #52b788 100%)' },
    { id: 'night', name: 'Night Sky', type: 'gradient', value: 'radial-gradient(ellipse at top, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' },
    { id: 'lavender', name: 'Lavender', type: 'gradient', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { id: 'fire', name: 'Volcano', type: 'gradient', value: 'linear-gradient(180deg, #1a0a00 0%, #8b1a00 50%, #ff4500 100%)' },
    { id: 'arctic', name: 'Arctic', type: 'gradient', value: 'linear-gradient(180deg, #e8f4f8 0%, #b8d4e8 50%, #88b4d8 100%)' },
    { id: 'black', name: 'Black', type: 'solid', value: '#000000' },
    { id: 'navy', name: 'Navy', type: 'solid', value: '#001f3f' },
    { id: 'dark-green', name: 'Dark Green', type: 'solid', value: '#0a3d0a' },
    { id: 'pattern-dots', name: 'Dots', type: 'pattern', value: 'radial-gradient(circle, #ffffff22 1px, transparent 1px) 0 0 / 20px 20px, #1a3a5c' },
    { id: 'pattern-lines', name: 'Lines', type: 'pattern', value: 'repeating-linear-gradient(45deg, #ffffff08 0px, #ffffff08 1px, transparent 1px, transparent 10px), #1a1a2e' },
    { id: 'pattern-grid', name: 'Grid', type: 'pattern', value: 'linear-gradient(#ffffff11 1px, transparent 1px), linear-gradient(90deg, #ffffff11 1px, transparent 1px) 0 0 / 30px 30px, #0d2137' },
  ];

  readonly accentColors = [
    { name: 'Blue', value: '#1a6db5' },
    { name: 'Green', value: '#1a7a1a' },
    { name: 'Red', value: '#aa1a1a' },
    { name: 'Purple', value: '#6a1a8a' },
    { name: 'Orange', value: '#c85a00' },
    { name: 'Teal', value: '#007a7a' },
    { name: 'Pink', value: '#aa1a6a' },
    { name: 'Gray', value: '#4a4a4a' },
  ];

  readonly timezones = [
    'UTC-12:00 — Baker Island',
    'UTC-08:00 — Pacific Time (US)',
    'UTC-07:00 — Mountain Time (US)',
    'UTC-06:00 — Central Time (US)',
    'UTC-05:00 — Eastern Time (US)',
    'UTC-05:00 — Lima, Bogotá',
    'UTC-04:00 — Caracas, La Paz',
    'UTC-03:00 — Buenos Aires',
    'UTC+00:00 — London, Dublin',
    'UTC+01:00 — Madrid, Paris, Berlin',
    'UTC+02:00 — Cairo, Athens',
    'UTC+03:00 — Moscow, Nairobi',
    'UTC+05:30 — Mumbai, New Delhi',
    'UTC+08:00 — Beijing, Singapore',
    'UTC+09:00 — Tokyo, Seoul',
    'UTC+10:00 — Sydney',
    'UTC+12:00 — Auckland',
  ];

  private readonly STORAGE_KEY = 'win7_settings';

  private _settings = signal<SystemSettings>(this.loadSettings());

  readonly settings = computed(() => this._settings());
  readonly wallpaper = computed(() => this._settings().wallpaper);
  readonly username = computed(() => this._settings().username);
  readonly volume = computed(() => this._settings().volume);
  readonly muted = computed(() => this._settings().muted);
  readonly accentColor = computed(() => this._settings().accentColor);
  readonly timezone = computed(() => this._settings().timezone);

  private loadSettings(): SystemSettings {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return this.defaultSettings();
  }

  private defaultSettings(): SystemSettings {
    return {
      username: 'User',
      volume: 75,
      muted: false,
      timezone: 'UTC-05:00 — Lima, Bogotá',
      wallpaper: this.wallpapers[0],
      accentColor: '#1a6db5',
    };
  }

  private save(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._settings()));
  }

  setWallpaper(wallpaper: Wallpaper): void {
    this._settings.update(s => ({ ...s, wallpaper }));
    this.save();
  }

  setVolume(volume: number): void {
    this._settings.update(s => ({ ...s, volume, muted: volume === 0 }));
    this.save();
    this.applyVolume(volume);
  }

  toggleMute(): void {
    this._settings.update(s => ({ ...s, muted: !s.muted }));
    this.save();
    this.applyVolume(this._settings().muted ? 0 : this._settings().volume);
  }

  setUsername(username: string): void {
    this._settings.update(s => ({ ...s, username }));
    this.save();
  }

  setTimezone(timezone: string): void {
    this._settings.update(s => ({ ...s, timezone }));
    this.save();
  }

  setAccentColor(color: string): void {
    this._settings.update(s => ({ ...s, accentColor: color }));
    this.save();
  }

  private applyVolume(volume: number): void {
    try {
      const ctx = new AudioContext();
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume / 100;
      gainNode.connect(ctx.destination);
    } catch {}
  }
}
