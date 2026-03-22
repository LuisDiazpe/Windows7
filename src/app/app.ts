import { Component } from '@angular/core';
import { DesktopComponent } from './presentation/desktop/components/desktop.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DesktopComponent],
  template: `<app-desktop />`,
})
export class App {}
