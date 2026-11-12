import type { Hitbox, HitboxId } from '../types';

/**
 * Dimensions are in Unreal Units (1 uu = 0.75 in). Length, width and height
 * are the community-measured collision box for each of the six body types.
 * Ground height is the community-reported figure where published.
 */
export const HITBOXES: Hitbox[] = [
  {
    id: 'octane',
    name: 'Octane',
    length: 118.0074,
    width: 84.19941,
    height: 36.15907,
    groundHeight: 48.46904,
    blurb:
      'The default all-rounder. Taller than Dominus and Breakout, which makes it forgiving on wall and ground bounces.',
    color: '#3F9BFF',
  },
  {
    id: 'dominus',
    name: 'Dominus',
    length: 127.9268,
    width: 83.27995,
    height: 31.3,
    groundHeight: 45.15254,
    blurb:
      'Long and low. The extra reach is popular for powerful flicks and hard, flat hits.',
    color: '#FF7A2F',
  },
  {
    id: 'breakout',
    name: 'Breakout',
    length: 131.4924,
    width: 80.521,
    height: 30.3,
    groundHeight: 54.858975,
    blurb:
      'The longest box and the narrowest of the six. Precise, flat and punchy through the ball.',
    color: '#C6F65A',
  },
  {
    id: 'plank',
    name: 'Plank',
    length: 128.8198,
    width: 84.67036,
    height: 29.3944,
    groundHeight: 55.860375,
    blurb:
      'The widest and lowest. Huge coverage for blocks and defence, and a favourite for freestyle spins.',
    color: '#21D4B4',
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    length: 127.0192,
    width: 82.18787,
    height: 34.15907,
    groundHeight: 45.44733,
    blurb:
      'Dominus length with extra height. Sits between the Octane and Dominus boxes.',
    color: '#A978FF',
  },
  {
    id: 'merc',
    name: 'Merc',
    length: 120.72,
    width: 76.71,
    height: 41.66,
    groundHeight: null,
    blurb:
      'The tallest hitbox in the game. Unusual proportions and a lot of vertical presence.',
    color: '#FF5F8F',
  },
];

export const HITBOX_BY_ID = Object.fromEntries(
  HITBOXES.map((hitbox) => [hitbox.id, hitbox]),
) as Record<HitboxId, Hitbox>;
