export type BoardModel = 'uno' | 'mega' | 'nano' | 'esp32' | 'esp32nano';

export interface BoardPin {
  number: number;
  type: 'digital' | 'analog' | 'power' | 'gnd' | 'sda' | 'scl' | 'tx' | 'rx';
  x: number;
  y: number;
  state: number; // 0-255
  mode: 'input' | 'output' | 'none';
}

export interface ArduinoBoard {
  model: BoardModel;
  label: string;
  width: number;
  height: number;
  color: string;
  pins: BoardPin[];
  imageUrl?: string;
}

export const BOARDS: Record<BoardModel, ArduinoBoard> = {
  uno: {
    model: 'uno',
    label: 'Arduino Uno',
    width: 320,
    height: 220,
    color: '#00878A',
    pins: [
      // Digital pins 0-13
      ...Array.from({ length: 14 }, (_, i) => ({
        number: i,
        type: 'digital' as const,
        x: 60 + i * 18,
        y: 20,
        state: 0,
        mode: 'none' as const,
      })),
      // Analog pins A0-A5
      ...Array.from({ length: 6 }, (_, i) => ({
        number: i + 14,
        type: 'analog' as const,
        x: 80 + i * 18,
        y: 200,
        state: 0,
        mode: 'none' as const,
      })),
      // Power pins
      { number: 98, type: 'power' as const, x: 30, y: 20, state: 5, mode: 'output' as const },
      { number: 99, type: 'gnd' as const, x: 48, y: 20, state: 0, mode: 'output' as const },
    ],
  },
  mega: {
    model: 'mega',
    label: 'Arduino Mega',
    width: 480,
    height: 220,
    color: '#00878A',
    pins: [
      ...Array.from({ length: 54 }, (_, i) => ({
        number: i,
        type: 'digital' as const,
        x: 30 + i * 8,
        y: 20,
        state: 0,
        mode: 'none' as const,
      })),
      ...Array.from({ length: 16 }, (_, i) => ({
        number: i + 54,
        type: 'analog' as const,
        x: 30 + i * 18,
        y: 200,
        state: 0,
        mode: 'none' as const,
      })),
      { number: 98, type: 'power' as const, x: 460, y: 20, state: 5, mode: 'output' as const },
      { number: 99, type: 'gnd' as const, x: 460, y: 40, state: 0, mode: 'output' as const },
    ],
  },
  nano: {
    model: 'nano',
    label: 'Arduino Nano',
    width: 200,
    height: 260,
    color: '#00878A',
    pins: [
      ...Array.from({ length: 14 }, (_, i) => ({
        number: i,
        type: 'digital' as const,
        x: 20,
        y: 40 + i * 16,
        state: 0,
        mode: 'none' as const,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        number: i + 14,
        type: 'analog' as const,
        x: 180,
        y: 40 + i * 16,
        state: 0,
        mode: 'none' as const,
      })),
      { number: 98, type: 'power' as const, x: 20, y: 20, state: 5, mode: 'output' as const },
      { number: 99, type: 'gnd' as const, x: 40, y: 20, state: 0, mode: 'output' as const },
    ],
  },
  esp32: {
    model: 'esp32',
    label: 'ESP32',
    width: 280,
    height: 260,
    color: '#3C4043',
    pins: [
      ...Array.from({ length: 19 }, (_, i) => ({
        number: i,
        type: 'digital' as const,
        x: 20,
        y: 40 + i * 12,
        state: 0,
        mode: 'none' as const,
      })),
      ...Array.from({ length: 19 }, (_, i) => ({
        number: i + 19,
        type: 'digital' as const,
        x: 260,
        y: 40 + i * 12,
        state: 0,
        mode: 'none' as const,
      })),
      { number: 98, type: 'power' as const, x: 20, y: 20, state: 3.3, mode: 'output' as const },
      { number: 99, type: 'gnd' as const, x: 40, y: 20, state: 0, mode: 'output' as const },
    ],
  },
  esp32nano: {
    model: 'esp32nano',
    label: 'ESP32 Nano',
    width: 200,
    height: 260,
    color: '#3C4043',
    pins: [
      ...Array.from({ length: 15 }, (_, i) => ({
        number: i,
        type: 'digital' as const,
        x: 20,
        y: 40 + i * 14,
        state: 0,
        mode: 'none' as const,
      })),
      ...Array.from({ length: 15 }, (_, i) => ({
        number: i + 15,
        type: 'digital' as const,
        x: 180,
        y: 40 + i * 14,
        state: 0,
        mode: 'none' as const,
      })),
      { number: 98, type: 'power' as const, x: 20, y: 20, state: 3.3, mode: 'output' as const },
      { number: 99, type: 'gnd' as const, x: 40, y: 20, state: 0, mode: 'output' as const },
    ],
  },
};
