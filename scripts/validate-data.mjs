import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/data/index.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
});

const code = result.outputFiles[0].text;
const data = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const { CARS, HITBOXES, BOOSTS, WORKSHOP_MAPS, PAINT_COLORS, PAINT_FINISHES } = data;

const failures = [];

function unique(label, values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  if (duplicates.size) failures.push(`${label}: duplicate ids -> ${[...duplicates].join(', ')}`);
}

unique('cars', CARS.map((car) => car.id));
unique('boosts', BOOSTS.map((boost) => boost.id));
unique('maps', WORKSHOP_MAPS.map((map) => map.id));

const hitboxIds = new Set(HITBOXES.map((hitbox) => hitbox.id));
for (const car of CARS) {
  if (!hitboxIds.has(car.hitbox)) failures.push(`car ${car.id} references unknown hitbox ${car.hitbox}`);
}

for (const hitbox of HITBOXES) {
  if (!(hitbox.length > 0 && hitbox.width > 0 && hitbox.height > 0)) {
    failures.push(`hitbox ${hitbox.id} has a non-positive dimension`);
  }
  if (hitbox.groundHeight !== null && hitbox.groundHeight <= 0) {
    failures.push(`hitbox ${hitbox.id} has a non-positive ground height`);
  }
}

for (const map of WORKSHOP_MAPS) {
  if (!/^\d+$/.test(map.id)) failures.push(`map ${map.name} has a non-numeric workshop id`);
  if (!(map.sizeMB >= 0)) failures.push(`map ${map.name} has an invalid size`);
}

const hex = /^#[0-9A-F]{6}$/i;
for (const color of PAINT_COLORS) {
  if (!hex.test(color.hex)) failures.push(`paint colour ${color.name} is not a 6-digit hex value`);
}
for (const boost of BOOSTS) {
  if (!hex.test(boost.tone)) failures.push(`boost ${boost.name} has an invalid preview tone`);
}

const finishIds = new Set(PAINT_FINISHES.map((finish) => finish.id));
if (!finishIds.has('glossy')) failures.push('paint finishes are missing glossy');

if (CARS.length < 150) failures.push(`only ${CARS.length} cars catalogued`);
if (BOOSTS.length < 120) failures.push(`only ${BOOSTS.length} boosts catalogued`);
if (WORKSHOP_MAPS.length < 40) failures.push(`only ${WORKSHOP_MAPS.length} maps catalogued`);
if (HITBOXES.length !== 6) failures.push(`expected 6 hitboxes, found ${HITBOXES.length}`);

if (failures.length) {
  console.error('Catalog validation failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `Catalog OK: ${CARS.length} cars across ${HITBOXES.length} hitboxes, ${BOOSTS.length} boosts, ` +
    `${WORKSHOP_MAPS.length} workshop maps, ${PAINT_COLORS.length} paint colours, ${PAINT_FINISHES.length} finishes.`,
);
