import {
  Component, signal, computed, inject,
  ViewChild, ElementRef, OnInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SystemSettingsService } from '../../../infrastructure/state/system-settings.service';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface Tab {
  id: string;
  title: string;
  url: string;
  favicon: string;
  loading: boolean;
  canEmbed: boolean;
  safeUrl?: SafeResourceUrl;
}

interface HistoryEntry {
  url: string;
  title: string;
  visitedAt: string;
}

interface Favorite {
  id: string;
  title: string;
  url: string;
  favicon: string;
}

@Component({
  selector: 'app-internet-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule, TitleCasePipe],
  templateUrl: './internet-explorer.component.html',
  styleUrl: './internet-explorer.component.css',
})
export class InternetExplorerComponent implements OnInit {
  @ViewChild('iframe') iframeRef!: ElementRef<HTMLIFrameElement>;

  private readonly sys = inject(SystemSettingsService);

  tabs = signal<Tab[]>([]);
  activeTabId = signal<string>('');
  urlInput = signal('');
  showHistory = signal(false);
  showFavorites = signal(false);
  showSettings = signal(false);
  isLoading = signal(false);
  navHistory: string[] = [];
  navIndex = -1;
  searchEngine = signal<'google' | 'bing' | 'duckduckgo'>('google');

  history = signal<HistoryEntry[]>([]);
  favorites = signal<Favorite[]>([]);
  toggleFavorites(): void { this.showFavorites.update(v => !v); }
  toggleHistory(): void { this.showHistory.update(v => !v); }
  toggleSettings(): void { this.showSettings.update(v => !v); }

  private readonly sanitizer = inject(DomSanitizer);

  getSafeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  // Sites that allow embedding
  private embeddableDomains = [
    'wikipedia.org', 'wikimedia.org', 'archive.org',
    'openstreetmap.org', 'example.com', 'httpbin.org',
    'weather.gov', 'nasa.gov', 'britannica.com',
    'wolframalpha.com', 'codepen.io', 'jsfiddle.net',
    'stackblitz.com', 'codesandbox.io',
  ];

  // Quick access sites
  readonly quickLinks = [
    { name: 'Google', url: 'https://www.google.com', icon: 'G', color: '#4285f4' },
    { name: 'YouTube', url: 'https://www.youtube.com', icon: 'Y', color: '#ff0000' },
    { name: 'Wikipedia', url: 'https://en.wikipedia.org', icon: 'W', color: '#333' },
    { name: 'Facebook', url: 'https://www.facebook.com', icon: 'f', color: '#1877f2' },
    { name: 'Twitter', url: 'https://www.twitter.com', icon: 'X', color: '#000' },
    { name: 'GitHub', url: 'https://www.github.com', icon: 'GH', color: '#333' },
    { name: 'Reddit', url: 'https://www.reddit.com', icon: 'R', color: '#ff4500' },
    { name: 'Archive', url: 'https://archive.org', icon: 'A', color: '#666' },
  ];

  ngOnInit(): void {
    this.loadHistory();
    this.loadFavorites();
    this.newTab('https://start.windows7.local');
  }

  private loadHistory(): void {
    try {
      const saved = localStorage.getItem('ie_history');
      if (saved) this.history.set(JSON.parse(saved));
    } catch {}
  }

  private loadFavorites(): void {
    try {
      const saved = localStorage.getItem('ie_favorites');
      if (saved) this.favorites.set(JSON.parse(saved));
    } catch {
      this.favorites.set([
        { id: '1', title: 'Wikipedia', url: 'https://en.wikipedia.org', favicon: 'W' },
        { id: '2', title: 'Internet Archive', url: 'https://archive.org', favicon: 'A' },
        { id: '3', title: 'Google', url: 'https://www.google.com', favicon: 'G' },
      ]);
    }
  }

  private saveHistory(): void {
    localStorage.setItem('ie_history', JSON.stringify(this.history().slice(0, 100)));
  }

  private saveFavorites(): void {
    localStorage.setItem('ie_favorites', JSON.stringify(this.favorites()));
  }

  readonly activeTab = computed(() =>
    this.tabs().find(t => t.id === this.activeTabId())
  );

  newTab(url = 'https://start.windows7.local'): void {
    const id = crypto.randomUUID();
    const tab: Tab = {
      id,
      title: url === 'https://start.windows7.local' ? 'New Tab' : this.getDomain(url),
      url,
      favicon: this.getFavicon(url),
      loading: false,
      canEmbed: url === 'https://start.windows7.local',
    };
    this.tabs.update(tabs => [...tabs, tab]);
    this.activeTabId.set(id);
    this.urlInput.set(url === 'https://start.windows7.local' ? '' : url);
    if (url !== 'https://start.windows7.local') {
      this.navigate(url);
    }
  }

  closeTab(id: string, e: MouseEvent): void {
    e.stopPropagation();
    const tabs = this.tabs().filter(t => t.id !== id);
    if (tabs.length === 0) {
      this.newTab();
      return;
    }
    this.tabs.set(tabs);
    if (this.activeTabId() === id) {
      this.activeTabId.set(tabs[tabs.length - 1].id);
    }
  }

  switchTab(id: string): void {
    this.activeTabId.set(id);
    const tab = this.tabs().find(t => t.id === id);
    if (tab) this.urlInput.set(tab.url === 'https://start.windows7.local' ? '' : tab.url);
  }

  onUrlKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.go();
  }

  go(): void {
    let input = this.urlInput().trim();
    if (!input) return;

    // Si parece una búsqueda, usar buscador
    if (!input.includes('.') || input.includes(' ')) {
      input = this.buildSearchUrl(input);
    } else if (!input.startsWith('http')) {
      input = 'https://' + input;
    }

    this.navigate(input);
  }

  navigate(url: string): void {
    this.urlInput.set(url);
    const canEmbed = this.canEmbedUrl(url);
    const safeUrl = canEmbed ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : undefined;

    this.updateActiveTab({ url, loading: true, canEmbed, title: this.getDomain(url), safeUrl });
    this.isLoading.set(true);

    if (!canEmbed) {
      window.open(url, '_blank');
      setTimeout(() => {
        this.updateActiveTab({ loading: false, title: this.getDomain(url), url });
        this.isLoading.set(false);
      }, 500);
    } else {
      setTimeout(() => {
        this.updateActiveTab({ loading: false });
        this.isLoading.set(false);
      }, 1500);
    }

    this.addToHistory(url, this.getDomain(url));

    if (this.navIndex < this.navHistory.length - 1) {
      this.navHistory = this.navHistory.slice(0, this.navIndex + 1);
    }
    this.navHistory.push(url);
    this.navIndex = this.navHistory.length - 1;
  }

  back(): void {
    if (this.navIndex > 0) {
      this.navIndex--;
      const url = this.navHistory[this.navIndex];
      this.urlInput.set(url);
      this.updateActiveTab({ url, canEmbed: this.canEmbedUrl(url) });
    }
  }

  forward(): void {
    if (this.navIndex < this.navHistory.length - 1) {
      this.navIndex++;
      const url = this.navHistory[this.navIndex];
      this.urlInput.set(url);
      this.updateActiveTab({ url, canEmbed: this.canEmbedUrl(url) });
    }
  }

  reload(): void {
    const tab = this.activeTab();
    if (tab) this.navigate(tab.url);
  }

  goHome(): void {
    this.urlInput.set('');
    this.updateActiveTab({
      url: 'https://start.windows7.local',
      title: 'New Tab',
      canEmbed: true,
      loading: false,
    });
  }

  stop(): void {
    this.isLoading.set(false);
    this.updateActiveTab({ loading: false });
  }

  openQuickLink(url: string): void {
    this.navigate(url);
  }

  addToFavorites(): void {
    const tab = this.activeTab();
    if (!tab || tab.url === 'https://start.windows7.local') return;
    const exists = this.favorites().some(f => f.url === tab.url);
    if (exists) return;
    const fav: Favorite = {
      id: crypto.randomUUID(),
      title: tab.title,
      url: tab.url,
      favicon: this.getFavicon(tab.url),
    };
    this.favorites.update(favs => [...favs, fav]);
    this.saveFavorites();
  }

  removeFavorite(id: string): void {
    this.favorites.update(favs => favs.filter(f => f.id !== id));
    this.saveFavorites();
  }

  clearHistory(): void {
    this.history.set([]);
    localStorage.removeItem('ie_history');
  }

  private addToHistory(url: string, title: string): void {
    if (url === 'https://start.windows7.local') return;
    const entry: HistoryEntry = {
      url,
      title,
      visitedAt: new Date().toLocaleString(),
    };
    this.history.update(h => [entry, ...h.filter(e => e.url !== url)].slice(0, 100));
    this.saveHistory();
  }

  private buildSearchUrl(query: string): string {
    const q = encodeURIComponent(query);
    switch (this.searchEngine()) {
      case 'bing': return `https://www.bing.com/search?q=${q}`;
      case 'duckduckgo': return `https://duckduckgo.com/?q=${q}`;
      default: return `https://www.google.com/search?q=${q}`;
    }
  }

  canEmbedUrl(url: string): boolean {
    if (url === 'https://start.windows7.local') return true;
    try {
      const domain = new URL(url).hostname;
      return this.embeddableDomains.some(d => domain.includes(d));
    } catch { return false; }
  }

  private updateActiveTab(updates: Partial<Tab>): void {
    this.tabs.update(tabs =>
      tabs.map(t => t.id === this.activeTabId() ? { ...t, ...updates } : t)
    );
  }

  getDomain(url: string): string {
    if (url === 'https://start.windows7.local') return 'New Tab';
    try { return new URL(url).hostname.replace('www.', ''); }
    catch { return url; }
  }

  getFavicon(url: string): string {
    if (url === 'https://start.windows7.local') return '🏠';
    try {
      const domain = new URL(url).hostname;
      return domain.charAt(0).toUpperCase();
    } catch { return '🌐'; }
  }

  isStartPage(): boolean {
    return this.activeTab()?.url === 'https://start.windows7.local';
  }

  get canGoBack(): boolean { return this.navIndex > 0; }
  get canGoForward(): boolean { return this.navIndex < this.navHistory.length - 1; }

  getSearchEngineUrl(): string {
    switch (this.searchEngine()) {
      case 'bing': return 'https://www.bing.com';
      case 'duckduckgo': return 'https://duckduckgo.com';
      default: return 'https://www.google.com';
    }
  }
}
