// Cloudflare Worker: بيبعت إشعارات الأدوية (Web Push) في ميعادها بالظبط، كل دقيقة.
// - POST /sync  : التطبيق بيسجّل اشتراك الموبايل ومنبهاته
// - cron كل دقيقة: بيبعت الجرعات المستحقة
const enc = new TextEncoder();
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

// تشفير الرسالة حسب RFC 8291 (aes128gcm)
export async function encryptPayload(sub, text) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdf(auth, secret, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const cek = await hkdf(salt, prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, prk, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(text), new Uint8Array([2]))));
  return concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([65]), asPub, ct);
}

// توقيع VAPID
const vcache = new Map();
export async function vapidHeader(env, endpoint) {
  const aud = new URL(endpoint).origin, c = vcache.get(aud);
  if (c && c.exp > Date.now() + 3600e3) return c.h;
  const exp = Date.now() + 12 * 3600e3;
  const h = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const p = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(exp / 1000), sub: env.VAPID_SUBJECT })));
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(h + '.' + p));
  const v = 'vapid t=' + h + '.' + p + '.' + b64u(sig) + ', k=' + env.VAPID_PUBLIC;
  vcache.set(aud, { h: v, exp });
  return v;
}

// أول ميعاد جرعة بعد وقت معين (null لو المدة خلصت)
export function nextDose(r, after) {
  const t = r.a + Math.max(0, Math.floor((after - r.a) / r.step) + 1) * r.step;
  return r.ends && t >= r.ends ? null : t;
}

async function sendPush(env, row, message) {
  const body = await encryptPayload({ keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(message));
  return fetch(row.endpoint, { method: 'POST', headers: { Authorization: await vapidHeader(env, row.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '1800', Urgency: 'high' }, body });
}

export async function tick(env, nowMs = Date.now()) {
  const { results } = await env.DB.prepare('SELECT r.id, r.endpoint, r.name, r.a, r.step, r.ends, r.next_due, s.p256dh, s.auth FROM reminders r JOIN subs s ON s.endpoint = r.endpoint WHERE r.next_due IS NOT NULL AND r.next_due <= ?1 ORDER BY r.next_due LIMIT 40').bind(nowMs + 5000).all();
  const out = [];
  for (const r of results) {
    const late = nowMs - r.next_due > 30 * 60000; // فاتت من زمان: نتخطاها
    let ok = false, gone = false;
    if (!late) {
      try { const res = await sendPush(env, r, { title: '⏰ ميعاد الدواء', body: r.name, k: r.id + '|' + r.next_due }); ok = res.ok; gone = res.status === 404 || res.status === 410; } catch (e) {}
      if (ok) await env.DB.prepare('INSERT OR REPLACE INTO alerts (endpoint, k, name, tries, repeat_at) VALUES (?1, ?2, ?3, 0, ?4)').bind(r.endpoint, r.id + '|' + r.next_due, r.name, nowMs + 60000).run();
    }
    if (gone) {
      await dropSub(env, r.endpoint);
      out.push({ id: r.id, gone: true }); continue;
    }
    if (!ok && !late) { out.push({ id: r.id, retry: true }); continue; } // نحاول تاني في الدقيقة الجاية
    const nx = nextDose(r, Math.max(r.next_due, nowMs));
    await (nx === null ? env.DB.prepare('DELETE FROM reminders WHERE endpoint = ?1 AND id = ?2').bind(r.endpoint, r.id) : env.DB.prepare('UPDATE reminders SET next_due = ?1 WHERE endpoint = ?2 AND id = ?3').bind(nx, r.endpoint, r.id)).run();
    out.push({ id: r.id, sent: ok });
  }
  // تكرار التنبيه كل دقيقة لحد ما العميل يضغط "أخدته" (أو لحد REPEATS مرة)
  const max = +env.REPEATS || 5;
  const al = await env.DB.prepare('SELECT a.endpoint, a.k, a.name, a.tries, a.repeat_at, s.p256dh, s.auth FROM alerts a JOIN subs s ON s.endpoint = a.endpoint WHERE a.repeat_at <= ?1 ORDER BY a.repeat_at LIMIT 20').bind(nowMs + 5000).all();
  for (const a of al.results) {
    if (nowMs - a.repeat_at > 30 * 60000) { await env.DB.prepare('DELETE FROM alerts WHERE endpoint = ?1 AND k = ?2').bind(a.endpoint, a.k).run(); continue; }
    let ok = false, gone = false;
    try { const res = await sendPush(env, a, { title: '⏰ لسه ما أخدتش الدواء', body: a.name, k: a.k, repeat: a.tries + 1 }); ok = res.ok; gone = res.status === 404 || res.status === 410; } catch (e) {}
    if (gone) { await dropSub(env, a.endpoint); out.push({ k: a.k, gone: true }); continue; }
    await (a.tries + 1 >= max ? env.DB.prepare('DELETE FROM alerts WHERE endpoint = ?1 AND k = ?2').bind(a.endpoint, a.k) : env.DB.prepare('UPDATE alerts SET tries = tries + 1, repeat_at = ?3 WHERE endpoint = ?1 AND k = ?2').bind(a.endpoint, a.k, nowMs + 60000)).run();
    out.push({ k: a.k, repeat: a.tries + 1, sent: ok });
  }
  return out;
}

async function dropSub(env, endpoint) {
  await env.DB.batch([env.DB.prepare('DELETE FROM alerts WHERE endpoint = ?1').bind(endpoint), env.DB.prepare('DELETE FROM reminders WHERE endpoint = ?1').bind(endpoint), env.DB.prepare('DELETE FROM subs WHERE endpoint = ?1').bind(endpoint)]);
}

// العميل ضغط "أخدته" أو "بعد 10 دقايق" أو شال الإشعار
async function ack(req, env) {
  const raw = await req.text(); if (raw.length > 2000) return new Response('too big', { status: 413 });
  let b; try { b = JSON.parse(raw); } catch (e) { return new Response('bad json', { status: 400 }); }
  if (typeof b.endpoint !== 'string' || typeof b.k !== 'string') return new Response('bad', { status: 400 });
  await (b.snooze ? env.DB.prepare('UPDATE alerts SET tries = 0, repeat_at = ?3 WHERE endpoint = ?1 AND k = ?2').bind(b.endpoint, b.k, Date.now() + 10 * 60000) : env.DB.prepare('DELETE FROM alerts WHERE endpoint = ?1 AND k = ?2').bind(b.endpoint, b.k)).run();
  return new Response('ok');
}

const cors = env => ({ 'Access-Control-Allow-Origin': env.ALLOW_ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
const num = (v, lo, hi) => Number.isFinite(+v) && +v >= lo && +v <= hi;

async function sync(req, env) {
  const raw = await req.text();
  if (raw.length > 30000) return new Response('too big', { status: 413 });
  let b; try { b = JSON.parse(raw); } catch (e) { return new Response('bad json', { status: 400 }); }
  const s = b.sub, list = Array.isArray(b.reminders) ? b.reminders : [];
  if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 700 || !s.keys || !s.keys.p256dh || !s.keys.auth || list.length > 30) return new Response('bad sub', { status: 400 });
  const now = Date.now(), st = [env.DB.prepare('INSERT INTO subs (endpoint, p256dh, auth, updated) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(endpoint) DO UPDATE SET p256dh = ?2, auth = ?3, updated = ?4').bind(s.endpoint, s.keys.p256dh, s.keys.auth, now)];
  const ok = list.filter(r => r && typeof r.id === 'string' && r.id.length <= 120 && typeof r.name === 'string' && r.name.length <= 160 && num(r.a, 1e12, 4e12) && num(r.every, 1, 48) && num(r.days || 0, 0, 365) && num(r.last, 1e12, 4e12));
  st.push(env.DB.prepare('DELETE FROM reminders WHERE endpoint = ?1' + (ok.length ? ' AND id NOT IN (' + ok.map((_, i) => '?' + (i + 2)).join(',') + ')' : '')).bind(s.endpoint, ...ok.map(r => r.id)));
  for (const r of ok) {
    const step = Math.round(+r.every * 3600000), a = Math.round(+r.a), ends = +r.days > 0 ? a + Math.round(+r.days * 86400000) : 0;
    st.push(env.DB.prepare('INSERT INTO reminders (id, endpoint, name, a, step, ends, next_due) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(endpoint, id) DO UPDATE SET name = ?3').bind(r.id, s.endpoint, r.name, a, step, ends, nextDose({ a, step, ends }, Math.round(+r.last))));
  }
  await env.DB.batch(st);
  return new Response(JSON.stringify({ ok: true, reminders: ok.length }), { headers: { 'Content-Type': 'application/json' } });
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url), h = cors(env);
    if (req.method === 'OPTIONS') return new Response(null, { headers: h });
    if (req.method === 'POST' && (u.pathname === '/sync' || u.pathname === '/ack')) {
      if (req.headers.get('Origin') !== env.ALLOW_ORIGIN) return new Response('forbidden', { status: 403, headers: h });
      const r = await (u.pathname === '/ack' ? ack(req, env) : sync(req, env)); const hh = new Headers(r.headers); Object.entries(h).forEach(([k, v]) => hh.set(k, v));
      return new Response(r.body, { status: r.status, headers: hh });
    }
    return new Response('dawaay push worker: ok');
  },
  async scheduled(ev, env, ctx) { ctx.waitUntil(tick(env)); },
};
