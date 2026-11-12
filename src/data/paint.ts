import type { PaintColor, PaintFinish, Team } from '../types';

export const PAINT_COLORS: PaintColor[] = [
  { name: 'Titanium White', hex: '#F2F5F7' },
  { name: 'Grey', hex: '#9AA3AD' },
  { name: 'Black', hex: '#14181C' },
  { name: 'Crimson', hex: '#C8172B' },
  { name: 'Maroon', hex: '#6B1626' },
  { name: 'Rose', hex: '#E8567A' },
  { name: 'Pink', hex: '#F25CA2' },
  { name: 'Magenta', hex: '#E23BB0' },
  { name: 'Purple', hex: '#7A3FD8' },
  { name: 'Violet', hex: '#A24BF0' },
  { name: 'Lavender', hex: '#B7A6FF' },
  { name: 'Navy', hex: '#102A57' },
  { name: 'Cobalt', hex: '#1F4FD8' },
  { name: 'Sky Blue', hex: '#3FA9F5' },
  { name: 'Aqua', hex: '#57E0E8' },
  { name: 'Ice', hex: '#CDEFFF' },
  { name: 'Teal', hex: '#16C7B4' },
  { name: 'Mint', hex: '#8EF0C6' },
  { name: 'Emerald', hex: '#0FA36B' },
  { name: 'Forest Green', hex: '#1E6B3A' },
  { name: 'Olive', hex: '#7C8C2B' },
  { name: 'Lime', hex: '#A6F32B' },
  { name: 'Saffron', hex: '#F5C518' },
  { name: 'Gold', hex: '#E8B84B' },
  { name: 'Orange', hex: '#F26A1B' },
  { name: 'Coral', hex: '#FF7A63' },
  { name: 'Peach', hex: '#FFB489' },
  { name: 'Burnt Sienna', hex: '#8C4A2F' },
  { name: 'Copper', hex: '#B87333' },
  { name: 'Sand', hex: '#D8C39A' },
  { name: 'Slate', hex: '#46525F' },
  { name: 'Steel', hex: '#7C8B9B' },
];

/** Painted-item inspired finishes, plus the stock materials. */
export const PAINT_FINISHES: PaintFinish[] = [
  { id: 'glossy', name: 'Glossy' },
  { id: 'matte', name: 'Matte' },
  { id: 'metallic', name: 'Metallic' },
  { id: 'metallic-smooth', name: 'Metallic (Smooth)' },
  { id: 'pearlescent', name: 'Pearlescent' },
  { id: 'pearlescent-smooth', name: 'Pearlescent (Smooth)' },
  { id: 'anodized', name: 'Anodized' },
  { id: 'anodized-pearl', name: 'Anodized Pearl' },
  { id: 'brushed-metal', name: 'Brushed Metal' },
  { id: 'toon-glossy', name: 'Toon Glossy' },
  { id: 'toon-matte', name: 'Toon Matte' },
  { id: 'straight-line', name: 'Straight-Line' },
  { id: 'sun-damaged', name: 'Sun-Damaged' },
  { id: 'corroded-metal', name: 'Corroded Metal' },
  { id: 'wood', name: 'Wood' },
  { id: 'knitted-yarn', name: 'Knitted Yarn' },
  { id: 'cookie-dough', name: 'Cookie Dough' },
  { id: 'moon-rock', name: 'Moon Rock' },
];

export const FINISH_BY_ID = Object.fromEntries(
  PAINT_FINISHES.map((finish) => [finish.id, finish]),
) as Record<string, PaintFinish | undefined>;

export const TEAM_DEFAULTS: Record<Team, { primary: string; secondary: string }> = {
  blue: { primary: '#2E7FE6', secondary: '#DFE9F5' },
  orange: { primary: '#E37A26', secondary: '#F6E8D6' },
};

export const TEAM_ACCENT: Record<Team, string> = {
  blue: '#3F9BFF',
  orange: '#FF7A2F',
};
