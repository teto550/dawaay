// شغّله على جهازك مرة واحدة:  node gen-vapid.js
// الـ Public بيتحط في wrangler.toml وفي index.html. الـ Private JWK سرّ، بيتحط في Cloudflare بس.
const { generateKeyPairSync } = require('crypto');
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = privateKey.export({ format: 'jwk' }), pub = publicKey.export({ format: 'jwk' });
const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]).toString('base64url');
console.log('\nVAPID_PUBLIC (حطه في wrangler.toml وفي index.html):\n' + raw);
console.log('\nVAPID_PRIVATE_JWK (سرّ! الصقه لما wrangler يسألك):\n' + JSON.stringify(jwk) + '\n');
