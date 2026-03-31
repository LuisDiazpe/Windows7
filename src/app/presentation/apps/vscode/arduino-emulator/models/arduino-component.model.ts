export type ComponentType =
  | 'led' | 'button' | 'potentiometer' | 'lcd' | 'oled'
  | 'ultrasonic' | 'servo' | 'dht11' | 'motor_dc'
  | 'segment7' | 'buzzer' | 'humidity' | 'battery'
  | 'usbc' | 'wifi' | 'bluetooth';

export interface ComponentPin {
  name: string;       // VCC, GND, SIG, TRIG, ECHO, etc.
  connectedTo: number | null; // número de pin del Arduino
}

export interface EmulatorComponent {
  id: string;
  type: ComponentType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pins: ComponentPin[];
  state: Record<string, any>; // estado visual: ledOn, angle, text, etc.
  color?: string;
}

export interface ComponentTemplate {
  type: ComponentType;
  label: string;
  icon: string;        // icono del componente
  width: number;
  height: number;
  pins: Omit<ComponentPin, 'connectedTo'>[];
  defaultState: Record<string, any>;
  category: 'output' | 'input' | 'power' | 'communication';
}

export const COMPONENT_TEMPLATES: ComponentTemplate[] = [
  {
    type: 'led',
    label: 'LED',
    icon: '💡',
    width: 60,
    height: 60,
    pins: [{ name: 'A' }, { name: 'K' }],
    defaultState: { on: false, color: '#ff0000', brightness: 0 },
    category: 'output',
  },
  {
    type: 'button',
    label: 'Botón',
    icon: '🔘',
    width: 60,
    height: 60,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'SIG' }],
    defaultState: { pressed: false },
    category: 'input',
  },
  {
    type: 'potentiometer',
    label: 'Potenciómetro',
    icon: '🎛️',
    width: 70,
    height: 70,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'SIG' }],
    defaultState: { value: 512, angle: 135 },
    category: 'input',
  },
  {
    type: 'lcd',
    label: 'LCD 16x2',
    icon: '📺',
    width: 160,
    height: 60,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'SDA' }, { name: 'SCL' }],
    defaultState: { lines: ['', ''] },
    category: 'output',
  },
  {
    type: 'oled',
    label: 'Pantalla OLED',
    icon: '🖥️',
    width: 120,
    height: 100,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'SDA' }, { name: 'SCL' }],
    defaultState: { pixels: [], text: '' },
    category: 'output',
  },
  {
    type: 'ultrasonic',
    label: 'HC-SR04',
    icon: '📡',
    width: 80,
    height: 50,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'TRIG' }, { name: 'ECHO' }],
    defaultState: { distance: 20 },
    category: 'input',
  },
  {
    type: 'servo',
    label: 'Servo Motor',
    icon: '⚙️',
    width: 80,
    height: 60,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'SIG' }],
    defaultState: { angle: 90 },
    category: 'output',
  },
  {
    type: 'dht11',
    label: 'DHT11',
    icon: '🌡️',
    width: 60,
    height: 70,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'DATA' }],
    defaultState: { temperature: 25, humidity: 60 },
    category: 'input',
  },
  {
    type: 'motor_dc',
    label: 'Motor DC L298N',
    icon: '🔄',
    width: 100,
    height: 80,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'IN1' }, { name: 'IN2' }, { name: 'ENA' }],
    defaultState: { speed: 0, direction: 'stop' },
    category: 'output',
  },
  {
    type: 'segment7',
    label: 'Display 7 Seg',
    icon: '7️⃣',
    width: 60,
    height: 90,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'A' }, { name: 'B' },
      { name: 'C' }, { name: 'D' }, { name: 'E' }, { name: 'F' }, { name: 'G' }],
    defaultState: { digit: 0, segments: [false, false, false, false, false, false, false] },
    category: 'output',
  },
  {
    type: 'buzzer',
    label: 'Buzzer',
    icon: '🔊',
    width: 60,
    height: 60,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'SIG' }],
    defaultState: { on: false, frequency: 0 },
    category: 'output',
  },
  {
    type: 'humidity',
    label: 'Sensor Humedad',
    icon: '💧',
    width: 60,
    height: 70,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'SIG' }],
    defaultState: { humidity: 50 },
    category: 'input',
  },
  {
    type: 'battery',
    label: 'Batería 9V',
    icon: '🔋',
    width: 70,
    height: 50,
    pins: [{ name: 'VCC' }, { name: 'GND' }],
    defaultState: { voltage: 9, charged: true },
    category: 'power',
  },
  {
    type: 'usbc',
    label: 'Puerto USB-C',
    icon: '🔌',
    width: 60,
    height: 40,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'D+' }, { name: 'D-' }],
    defaultState: { connected: false },
    category: 'power',
  },
  {
    type: 'wifi',
    label: 'Módulo WiFi',
    icon: '📶',
    width: 80,
    height: 60,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'TX' }, { name: 'RX' }],
    defaultState: { connected: false, ssid: '', ip: '' },
    category: 'communication',
  },
  {
    type: 'bluetooth',
    label: 'Módulo BT',
    icon: '📲',
    width: 80,
    height: 60,
    pins: [{ name: 'VCC' }, { name: 'GND' }, { name: 'TX' }, { name: 'RX' }],
    defaultState: { connected: false, paired: false },
    category: 'communication',
  },
];
