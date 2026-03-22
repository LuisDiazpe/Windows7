import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PanelItem {
  name: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './control-panel.component.html',
  styleUrl: './control-panel.component.css',
})
export class ControlPanelComponent {
  items: PanelItem[] = [
    { name: 'System', description: 'View basic info about your computer', color: '#4a90d9' },
    { name: 'Display', description: 'Change screen resolution and appearance', color: '#50b050' },
    { name: 'Network', description: 'View network status and tasks', color: '#e09020' },
    { name: 'User Accounts', description: 'Change account settings', color: '#9050d0' },
    { name: 'Windows Update', description: 'Turn automatic updating on or off', color: '#4a90d9' },
    { name: 'Programs', description: 'Uninstall a program', color: '#d05050' },
    { name: 'Security Center', description: 'Check security status', color: '#50a050' },
    { name: 'Firewall', description: 'Check firewall status', color: '#d07020' },
    { name: 'Sound', description: 'Adjust system volume', color: '#5080d0' },
    { name: 'Mouse', description: 'Change mouse settings', color: '#808080' },
    { name: 'Keyboard', description: 'Change keyboard settings', color: '#606060' },
    { name: 'Date and Time', description: 'Set the date, time and time zone', color: '#4090c0' },
  ];

  selectedItem: PanelItem | null = null;

  select(item: PanelItem): void {
    this.selectedItem = item;
  }

  open(item: PanelItem): void {
    alert(`${item.name} is not yet implemented.`);
  }
}
