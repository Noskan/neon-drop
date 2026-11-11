// Regenerates the catalog seed inside supabase/schema.sql from the catalog defined in app.js,
// so the server rolls exactly the items (and base prices) the client displays.
//
//   node tools/build-catalog-sql.mjs
//
// Run it whenever CASE_DEFINITIONS, SPECIAL_POOLS, RARITIES or buildOriginalCatalog() change,
// then re-run supabase/schema.sql in the Supabase SQL Editor.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appSrc = readFileSync(join(root, 'app.js'), 'utf8');

const slice = (startMarker, endMarker) => {
  const start = appSrc.indexOf(startMarker);
  const end = appSrc.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error(`Marker not found: ${startMarker} … ${endMarker}`);
  return appSrc.slice(start, end);
};

const code = [
  slice('const RARITIES = {', 'const RARITY_ORDER'),
  slice('const CASE_DEFINITIONS = [', 'let ALL_CASES'),
  'return buildOriginalCatalog();',
].join('\n');
const cases = new Function(code)();

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const caseRows = cases.map((c) => `  (${q(c.id)}, ${c.tier}, ${q(c.name)}, ${c.price})`);
const itemRows = cases.flatMap((c) =>
  c.items.map(
    (i) => `  (${q(i.id)}, ${q(c.id)}, ${q(i.name)}, ${q(i.rarity)}, ${q(i.shape)}, ${q(i.c1)}, ${q(i.c2)}, ${q(i.pattern)}, ${i.basePrice})`
  )
);

const block = `-- <catalog-seed> (gerado por tools/build-catalog-sql.mjs — não edite à mão)
INSERT INTO public.case_catalog (id, tier, name, price) VALUES
${caseRows.join(',\n')}
ON CONFLICT (id) DO UPDATE SET tier = EXCLUDED.tier, name = EXCLUDED.name, price = EXCLUDED.price;

INSERT INTO public.item_catalog (template_id, case_id, name, rarity, shape, c1, c2, pattern, base_price) VALUES
${itemRows.join(',\n')}
ON CONFLICT (template_id) DO UPDATE SET
  case_id = EXCLUDED.case_id, name = EXCLUDED.name, rarity = EXCLUDED.rarity, shape = EXCLUDED.shape,
  c1 = EXCLUDED.c1, c2 = EXCLUDED.c2, pattern = EXCLUDED.pattern, base_price = EXCLUDED.base_price;
-- </catalog-seed>`;

const schemaPath = join(root, 'supabase', 'schema.sql');
const schema = readFileSync(schemaPath, 'utf8');
const re = /-- <catalog-seed>[\s\S]*?-- <\/catalog-seed>/;
if (!re.test(schema)) throw new Error('catalog-seed markers not found in supabase/schema.sql');
writeFileSync(schemaPath, schema.replace(re, () => block));
console.log(`catalog seed written: ${cases.length} cases, ${itemRows.length} items`);
