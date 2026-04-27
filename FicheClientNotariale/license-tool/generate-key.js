#!/usr/bin/env node
'use strict';

/**
 * FicheClientNotariale — Outil de génération de clés de licence
 *
 * USAGE :
 *   node generate-key.js --type perpetual --customer 1
 *   node generate-key.js --type annual --customer 42 --fingerprint A3F2B8D1...
 *
 * Ce script est RÉSERVÉ AU VENDEUR. Ne jamais l'inclure dans l'installeur.
 */

const crypto = require('crypto');

// ── Doit correspondre exactement à la valeur dans main/license.js ──
const SECRET_KEY = Buffer.from(
  'a7f3c1e2b4d6908f5a2e7c4b1d9f3e6a8c2f5b7d0e4a1c9f6b3e8d5a2f4c7b1',
  'hex'
);

const B32_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0, value = 0, output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPHA[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) output += B32_ALPHA[(value << (5 - bits)) & 0x1f];
  return output;
}

function formatKey(raw) {
  // Format: FNOTAIRE + 4+4+4+4+4+2 (22 chars payload with dashes)
  const p = raw;
  return `FNOTAIRE-${p.slice(0,4)}-${p.slice(4,8)}-${p.slice(8,12)}-${p.slice(12,16)}-${p.slice(16,20)}-${p.slice(20,22)}`;
}

function generateKey({ type, customerId, fingerprint, issueDate }) {
  const typeCode = type === 'perpetual' ? 0x01 : 0x02;
  const issueDays = Math.floor((issueDate || Date.now()) / 86400000);

  const buf = Buffer.alloc(6);
  buf[0] = typeCode;
  buf.writeUInt32BE(issueDays, 1);
  buf.writeUInt16BE(customerId & 0xffff, 5);

  // HMAC computation (fingerprint may be empty for perpetual keys if unbound)
  const fp = fingerprint || '';
  const payload = Buffer.concat([buf, Buffer.from(fp, 'utf8')]);
  const hmac = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest();
  const hmacTrunc = hmac.slice(0, 7);

  const rawBytes = Buffer.concat([buf, hmacTrunc]); // 13 bytes total
  const b32 = base32Encode(rawBytes);               // ~22 chars
  const padded = b32.slice(0, 22).padEnd(22, '2');  // exactly 22

  return formatKey(padded);
}

// ── CLI argument parsing ──
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf('--' + name);
  return i !== -1 ? args[i + 1] : null;
}

const type = getArg('type') || 'annual';
const customerIdStr = getArg('customer');
const fingerprint = getArg('fingerprint') || '';
const issueDateStr = getArg('date'); // optional: YYYY-MM-DD

if (!customerIdStr) {
  console.error('Usage: node generate-key.js --type [perpetual|annual] --customer <ID> [--fingerprint <HEX>] [--date YYYY-MM-DD]');
  console.error('');
  console.error('Exemples :');
  console.error('  node generate-key.js --type annual --customer 42 --fingerprint A3F2B8D1C2E4...');
  console.error('  node generate-key.js --type perpetual --customer 1');
  process.exit(1);
}

if (type !== 'perpetual' && type !== 'annual') {
  console.error('Erreur: --type doit être "perpetual" ou "annual".');
  process.exit(1);
}

const customerId = parseInt(customerIdStr, 10);
if (isNaN(customerId) || customerId < 0 || customerId > 65535) {
  console.error('Erreur: --customer doit être un entier entre 0 et 65535.');
  process.exit(1);
}

const issueDate = issueDateStr ? new Date(issueDateStr).getTime() : Date.now();
const issueDateFR = new Date(issueDate).toLocaleDateString('fr-FR');
const expiryDateFR = type === 'annual'
  ? new Date(issueDate + 365 * 86400000).toLocaleDateString('fr-FR')
  : 'Aucune expiration (perpétuelle)';

const key = generateKey({ type, customerId, fingerprint, issueDate });

console.log('');
console.log('══════════════════════════════════════════');
console.log('  FicheClientNotariale — Clé de licence');
console.log('══════════════════════════════════════════');
console.log('  Type        :', type === 'perpetual' ? 'Perpétuelle' : 'Annuelle');
console.log('  Client n°   :', customerId);
console.log('  Émise le    :', issueDateFR);
console.log('  Expire le   :', expiryDateFR);
if (fingerprint) {
  console.log('  Machine     :', fingerprint.slice(0, 16) + '…');
}
console.log('');
console.log('  CLÉ :');
console.log('');
console.log(' ', key);
console.log('');
console.log('══════════════════════════════════════════');
console.log('');
