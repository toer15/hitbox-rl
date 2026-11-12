/**
 * Rocket League product ids for the in-game bridge (BakkesMod plugins address
 * items by product id, not by name).
 *
 * Seeding a body/boost here is enough for HITBOX to apply it in game:
 *   1. Equip the item in Rocket League (freeplay).
 *   2. Run `hitbox_dumploadout` in the BakkesMod console.
 *   3. Click "Import dump" in HITBOX setup, or read
 *      <bakkesmod folder>\hitbox_dump.txt (slot 0 = body, slot 3 = boost)
 *      and add the ids to the maps below.
 *
 * Known-good seeds only; anything unknown stays unmapped and simply does not
 * get applied until it is mapped.
 */
export const CAR_PRODUCT_IDS: Record<string, number> = {
  // The most famous id in the item database.
  Octane: 23,
};

export const BOOST_PRODUCT_IDS: Record<string, number> = {};

export function productIdFor(kind: 'car' | 'boost', name: string): number | undefined {
  const table = kind === 'car' ? CAR_PRODUCT_IDS : BOOST_PRODUCT_IDS;
  return table[name];
}
