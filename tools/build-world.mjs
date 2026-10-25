// بيحوّل ملفات FDA NDC الرسمية (مجانية ومفتوحة) لملفات قاعدة الأدوية العالمية بتاعة البرنامج.
// الاستخدام:  node build-world.mjs product.txt package.txt
// الناتج:     world.json  (الأدوية)  +  world-barcodes.json  (الباركود -> الدواء)
import { readFileSync, writeFileSync } from 'node:fs';

const [pf, kf] = process.argv.slice(2);
if (!pf || !kf) { console.error('الاستخدام: node build-world.mjs product.txt package.txt'); process.exit(1); }

const rows = f => { const l = readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean), h = l[0].split('\t'); return l.slice(1).map(x => { const c = x.split('\t'), o = {}; h.forEach((k, i) => o[k.trim()] = (c[i] || '').trim()); return o; }); };
const today = +new Date().toISOString().slice(0, 10).replace(/-/g, '');
const title = s => s.toLowerCase().replace(/(^|[\s(\/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

// GTIN-12 من الـ NDC: "3" + 10 أرقام الـ NDC + رقم تحقق
const gtin12 = ndc10 => { const b = '3' + ndc10, s = [...b].reduce((n, d, i) => n + +d * (i % 2 ? 1 : 3), 0); return b + ((10 - s % 10) % 10); };

const prods = new Map();
for (const p of rows(pf)) {
  if (!/^(HUMAN PRESCRIPTION|HUMAN OTC|VACCINE)/i.test(p.PRODUCTTYPENAME || '')) continue;
  if ((p.NDC_EXCLUDE_FLAG || '').toUpperCase() === 'Y') continue;
  if (p.ENDMARKETINGDATE && +p.ENDMARKETINGDATE < today) continue; // موقوف
  const sub = (p.SUBSTANCENAME || '').split(';').map(x => x.trim()).filter(Boolean);
  const num = (p.ACTIVE_NUMERATOR_STRENGTH || '').split(';').map(x => x.trim()), unit = (p.ACTIVE_INGRED_UNIT || '').split(';').map(x => x.trim().replace(/\/1$/, ''));
  const str = sub.map((_, i) => num[i] ? num[i] + ' ' + (unit[i] || '') : '').filter(Boolean).slice(0, 3).join(' / ');
  const brand = title(p.PROPRIETARYNAME || p.NONPROPRIETARYNAME || '');
  if (!brand) continue;
  const form = title((p.DOSAGEFORMNAME || '').replace(/,.*/, ''));
  prods.set(p.PRODUCTNDC, ['w' + p.PRODUCTNDC, '', [brand, str, form].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(), (sub.join('+') || (p.NONPROPRIETARYNAME || '')).toUpperCase(), 0, title(p.LABELERNAME || '')]);
}
const bc = {}; let n = 0;
for (const k of rows(kf)) {
  if (!prods.has(k.PRODUCTNDC)) continue;
  if ((k.NDC_EXCLUDE_FLAG || '').toUpperCase() === 'Y' || (k.SAMPLE_PACKAGE || '').toUpperCase() === 'Y') continue;
  if (k.ENDMARKETINGDATEPACKAGE && +k.ENDMARKETINGDATEPACKAGE < today) continue;
  const d = (k.NDCPACKAGECODE || '').replace(/\D/g, '');
  if (d.length !== 10) continue;
  bc[gtin12(d)] = 'w' + k.PRODUCTNDC; n++;
}
const list = [...prods.values()];
writeFileSync('world.json', JSON.stringify(list));
writeFileSync('world-barcodes.json', JSON.stringify(bc));
console.log(`تمام: ${list.length} دواء، ${Object.keys(bc).length} باركود (من ${n} عبوة).`);
