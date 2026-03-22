import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface CssArt {
  id: string;
  name: string;
  background: string;
  pattern?: string;
}

@Component({
  selector: 'app-pictures',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pictures.component.html',
  styleUrl: './pictures.component.css',
})
export class PicturesComponent {
  selectedArt = signal<CssArt | null>(null);

  readonly gallery: CssArt[] = [
    { id: 'aurora', name: 'Aurora Borealis', background: 'linear-gradient(135deg, #0d1b2a 0%, #1a3a2a 30%, #0d4a2a 50%, #1a2a3a 70%, #0d1b2a 100%)', pattern: 'radial-gradient(ellipse 60% 20% at 30% 40%, rgba(0,255,150,0.3) 0%, transparent 70%), radial-gradient(ellipse 40% 15% at 70% 50%, rgba(100,50,255,0.3) 0%, transparent 70%)' },
    { id: 'sunset', name: 'Desert Sunset', background: 'linear-gradient(180deg, #ff6b35 0%, #f7c59f 35%, #efefd0 60%, #8b6914 80%, #3d1c02 100%)' },
    { id: 'ocean', name: 'Deep Ocean', background: 'linear-gradient(180deg, #001a33 0%, #003366 30%, #006699 60%, #0099cc 80%, #00ccff 100%)', pattern: 'radial-gradient(ellipse at 20% 80%, rgba(255,255,255,0.05) 0%, transparent 50%)' },
    { id: 'galaxy', name: 'Galaxy', background: 'radial-gradient(ellipse at center, #1a0a2e 0%, #0d0514 60%, #000000 100%)', pattern: 'radial-gradient(circle, white 1px, transparent 1px) 10px 10px / 40px 40px, radial-gradient(circle, white 1px, transparent 1px) 30px 30px / 60px 60px' },
    { id: 'lava', name: 'Lava Flow', background: 'radial-gradient(ellipse at bottom, #ff4500 0%, #8b1a00 40%, #1a0500 100%)', pattern: 'radial-gradient(ellipse at 50% 80%, rgba(255,100,0,0.4) 0%, transparent 60%)' },
    { id: 'forest', name: 'Misty Forest', background: 'linear-gradient(180deg, #1a472a 0%, #2d6a4f 40%, #52b788 70%, #b7e4c7 100%)' },
    { id: 'neon', name: 'Neon City', background: '#0a0a0a', pattern: 'linear-gradient(transparent 0%, transparent 49%, rgba(0,255,255,0.03) 50%, transparent 51%) 0 0 / 100% 4px, linear-gradient(90deg, transparent 0%, transparent 49%, rgba(255,0,255,0.03) 50%, transparent 51%) 0 0 / 4px 100%' },
    { id: 'arctic', name: 'Arctic Ice', background: 'linear-gradient(180deg, #e8f4f8 0%, #b8d4e8 40%, #88b4d8 70%, #4880b0 100%)' },
    { id: 'volcano', name: 'Volcano', background: 'radial-gradient(circle at 50% 100%, #ff4500 0%, #cc2200 20%, #661100 50%, #1a0500 80%, #000000 100%)' },
    { id: 'spring', name: 'Spring Garden', background: 'linear-gradient(135deg, #a8e6cf 0%, #dcedc1 30%, #ffd3b6 60%, #ffaaa5 100%)' },
    { id: 'night', name: 'Night Sky', background: 'radial-gradient(ellipse at top, #0a0a2e 0%, #000000 100%)', pattern: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px) 0 0 / 50px 50px, radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px) 25px 25px / 30px 30px' },
    { id: 'cyberpunk', name: 'Cyberpunk', background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2a 50%, #0a1a2a 100%)', pattern: 'linear-gradient(rgba(0,255,255,0.05) 1px, transparent 1px) 0 0 / 40px 40px, linear-gradient(90deg, rgba(255,0,255,0.05) 1px, transparent 1px) 0 0 / 40px 40px' },
    { id: 'rainbow', name: 'Rainbow', background: 'linear-gradient(135deg, #ff0000 0%, #ff7700 16%, #ffff00 33%, #00ff00 50%, #0000ff 66%, #8b00ff 83%, #ff00ff 100%)' },
    { id: 'marble', name: 'White Marble', background: '#f5f5f0', pattern: 'repeating-linear-gradient(45deg, rgba(180,170,160,0.15) 0px, rgba(180,170,160,0.15) 1px, transparent 1px, transparent 20px), repeating-linear-gradient(-45deg, rgba(180,170,160,0.1) 0px, rgba(180,170,160,0.1) 1px, transparent 1px, transparent 30px)' },
    { id: 'wood', name: 'Dark Wood', background: 'repeating-linear-gradient(90deg, #3d1c02 0px, #5c2d0a 10px, #3d1c02 20px, #2a1000 30px)' },
    { id: 'sand', name: 'Sand Dunes', background: 'linear-gradient(180deg, #87ceeb 0%, #87ceeb 40%, #f4d03f 41%, #d4a017 60%, #c8a04a 80%, #b8860b 100%)' },
    { id: 'underwater', name: 'Underwater', background: 'linear-gradient(180deg, #006994 0%, #004d6e 50%, #003347 100%)', pattern: 'radial-gradient(ellipse 80% 20% at 50% 30%, rgba(100,200,255,0.1) 0%, transparent 100%)' },
    { id: 'cotton', name: 'Cotton Candy', background: 'linear-gradient(135deg, #ffb3c6 0%, #ffd6e7 30%, #c8b6ff 60%, #b8c0ff 100%)' },
    { id: 'mint', name: 'Mint Fresh', background: 'linear-gradient(135deg, #00b4db 0%, #0083b0 50%, #00c9b1 100%)' },
    { id: 'fire', name: 'Fire', background: 'radial-gradient(ellipse at bottom, #ffff00 0%, #ff8c00 30%, #ff4500 60%, #8b0000 100%)' },
  ];

  openArt(art: CssArt): void {
    this.selectedArt.set(art);
  }

  closeArt(): void {
    this.selectedArt.set(null);
  }

  getStyle(art: CssArt): string {
    if (art.pattern) {
      return `${art.pattern}, ${art.background}`;
    }
    return art.background;
  }
}
