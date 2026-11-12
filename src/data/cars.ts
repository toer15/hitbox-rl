import type { Car, HitboxId } from '../types';
import { slugify } from '../lib/slug';
import { CAR_PRODUCT_IDS } from './productIds';

/**
 * Every car body currently listed on Epic's official Rocket League hitbox
 * support page, grouped by the hitbox it uses. Variant families (e.g. Chikara,
 * Chikara G1, Chikara GXT) are kept together as a single garage entry.
 */
const GROUPS: Array<[HitboxId, string[]]> = [
  [
    'octane',
    [
      "007's Aston Martin DB5",
      'Armadillo',
      'Backfire',
      'BMW 1 Series / 1 Series RLE',
      'Bone Shaker',
      'Corlay',
      'Dingo',
      'Fast 4WD',
      'Fennec',
      'Fennec ZR-F',
      'Ford F-150 RLE',
      'Ford Mustang Mach-E RLE',
      'Gizmo',
      'Grog',
      'Harbinger / Harbinger GXT',
      'Hogsticker',
      'Honda Civic Type R / Civic Type R-LE',
      'Jackal',
      'Jurassic Jeep Wrangler',
      'Jeep Wrangler Rubicon',
      'Marauder',
      'Mario NSR / Luigi NSR',
      'Mudcat / Mudcat G1 / Mudcat GXT',
      'Octane',
      'Octane ZSR',
      'Outlaw / Outlaw GXT',
      'Patty Wagon',
      'Proteus',
      'Road Hog',
      'Road Hog XL',
      'Scarab',
      'Shokunin / Shokunin GXT',
      'Sweet Tooth',
      'Takumi',
      'Takumi RX-T',
      'The Dark Knight Tumbler',
      'Triton',
      'Twinzer',
      'Volkswagen Golf GTI / Golf GTI RLE',
      'Vulcan',
      'Xentari',
      'Zippy',
    ],
  ],
  [
    'dominus',
    [
      "'89 Batmobile",
      "007's Aston Martin DBS",
      "007's Aston Martin Valhalla",
      'Admiral',
      'Aftershock',
      'Batmobile (2022)',
      'BMW M3 (E30)',
      'BMW M4 GT3 EVO',
      'BMW M240i',
      'Bumblebee',
      'Chikara / Chikara G1 / Chikara GXT',
      'DeLorean Time Machine',
      'Diestro',
      'Dodger Charger Daytona Scat Pack',
      'Dominus',
      'Dominus GT',
      'Ecto-1',
      'Fast and Furious Dodge Charger',
      'Fast & Furious Dodge Charger SRT Hellcat',
      'Ferrari 296 GTB',
      'Ford Mustang Shelby GT350R RLE',
      'Ford Mustang GTD',
      'Gazella GT',
      'Guardian / Guardian G1 / Guardian GXT',
      "Homer's Car",
      'Hotshot',
      'Ice Charger',
      'Imperator DT5',
      'K.I.T.T.',
      'Lamborghini Countach LPI 800-4',
      'Lamborghini Huracán STO',
      'Lightning McQueen',
      'Lockjaw',
      'Maestro',
      'Magnifique',
      'Magnifique GXT',
      'Mamba',
      'Masamune',
      'Maverick / Maverick G1 / Maverick GXT',
      'McLaren 570S',
      'McLaren 765LT',
      'McLaren P1',
      'Mercedes-AMG GT 63 S',
      'Mercedes-Benz CLA',
      'MR11',
      'NASCAR Chevrolet Camaro',
      'NASCAR Ford Mustang',
      'NASCAR Toyota Camry',
      'NASCAR Next Gen Chevrolet Camaro (2022)',
      'NASCAR Next Gen Ford Mustang (2022)',
      'NASCAR Next Gen Toyota Camry (2022)',
      'Nemesis',
      'Nissan Fairlady Z / Fairlady Z RLE',
      'Nissan Z Performance',
      'Peregrine TT',
      'Porsche 911 GT3 RS',
      'Porsche 911 Turbo / 911 Turbo RLE',
      'Ripper',
      'Ronin / Ronin G1 / Ronin GXT',
      "Samus' Gunship",
      'Scorpion',
      'Tyranno / Tyranno GXT',
      'Werewolf',
    ],
  ],
  [
    'breakout',
    [
      '1966 Cadillac DeVille',
      'Ace',
      'Animus GP',
      'Azura',
      'Breakout',
      'Breakout Type-S',
      'Breakout X',
      'Chevrolet Corvette Stingray',
      'Chevrolet Corvette ZR1',
      'Cyberpunk Quadra',
      'Cyclone',
      'Diesel',
      'Emperor / Emperor II',
      'Fast and Furious Mazda RX-7',
      'Ferrari F40',
      'Fuse',
      'Komodo',
      'Mako',
      'McLaren Senna',
      'Megastar',
      'Nexus / Nexus SC',
      'Pontiac Firebird',
      'Porsche 918 Spyder',
      'Redline',
      'Revolver',
      'Samurai',
      'The Incredibile',
      'Whiplash',
    ],
  ],
  [
    'plank',
    [
      "'16 Batmobile",
      'Artemis / Artemis G1 / Artemis GXT',
      'Bugatti Centodieci',
      'Centio',
      'Formula 1 2021',
      'Formula 1 2022',
      'Mantis',
      'Paladin',
      'Sentinel',
      'Twin Mill III',
    ],
  ],
  [
    'hybrid',
    [
      'Beskar',
      'Endo',
      'Esper',
      'Fast and Furious Nissan Skyline',
      'Fast and Furious Pontiac Fiero',
      'Hearse',
      'Insidio',
      'Jäger 619',
      'Lamborghini Urus',
      'Nimbus',
      'Nissan Silvia / Silvia RLE',
      'Nissan Skyline GT-R (R32)',
      'Primo',
      'R3MX / R3MX GXT',
      'RAM 1500 RHO',
      'Tesla Cybertruck',
      'Tygris',
      'Venom',
      'Void Burn',
      'X-Devil',
      'X-Devil MK2',
    ],
  ],
  [
    'merc',
    [
      'Battle Bus',
      'Behemoth',
      'Chevrolet Astro',
      'Defender D7X-R',
      'Ford Bronco Raptor RLE',
      'Merc',
      'Nomad / Nomad GXT',
      'Recoil AV',
      'Stampede',
      'The Mystery Machine',
      'Turtle Van',
    ],
  ],
];

function buildCars(): Car[] {
  const used = new Map<string, number>();
  const cars: Car[] = [];

  for (const [hitbox, names] of GROUPS) {
    for (const name of names) {
      const base = slugify(name);
      const seen = used.get(base) ?? 0;
      used.set(base, seen + 1);
      cars.push({
        id: seen === 0 ? base : `${base}-${seen + 1}`,
        name,
        hitbox,
        ...(CAR_PRODUCT_IDS[name] ? { productId: CAR_PRODUCT_IDS[name] } : {}),
      });
    }
  }

  return cars;
}

export const CARS = buildCars();

export const CARS_BY_HITBOX = CARS.reduce<Record<HitboxId, Car[]>>(
  (groups, car) => {
    groups[car.hitbox].push(car);
    return groups;
  },
  { octane: [], dominus: [], breakout: [], plank: [], hybrid: [], merc: [] },
);

export function getCar(id: string): Car | undefined {
  return CARS.find((car) => car.id === id);
}
