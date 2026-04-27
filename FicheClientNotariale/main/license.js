'use strict';

const crypto = require('crypto');
const os = require('os');
const path = require('path');
const { app } = require('electron');

// ── Secret key (256-bit) — obfuscated at build time by javascript-obfuscator ──
// IMPORTANT: change this before distributing. Generate with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const SECRET_KEY = Buffer.from(
  'a7f3c1e2b4d6908f5a2e7c4b1d9f3e6a8c2f5b7d0e4a1c9f6b3e8d5a2f4c7b1',
  'hex'
);

// ── Base32 alphabet (RFC 4648) ──
const B32_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
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

function base32Decode(str) {
  str = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes = [];
  let bits = 0;
  let value = 0;
  for (let i = 0; i < str.length; i++) {
    const idx = B32_ALPHA.indexOf(str[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ── Machine fingerprint ──
function getMachineFingerprint() {
  let machineId;
  try {
    const { machineIdSync } = require('node-machine-id');
    machineId = machineIdSync({ original: true });
  } catch {
    // Fallback: hostname only (unlikely — node-machine-id is bundled)
    machineId = os.hostname();
  }
  const username = os.userInfo().username;
  const hostname = os.hostname();
  return crypto
    .createHash('sha256')
    .update(`${machineId}|${username}|${hostname}`)
    .digest('hex');
}

// ── Key validation ──
// Key binary layout (14 bytes → 22 Base32 chars):
//   [0]      TYPE          0x01=perpetual, 0x02=annual
//   [1..4]   ISSUE_DATE    uint32 BE — days since Unix epoch
//   [5..6]   CUSTOMER_ID   uint16 BE
//   [7..13]  HMAC_TRUNC    first 7 bytes of HMAC-SHA256(SECRET, TYPE‖DATE‖CUSTOMER‖FINGERPRINT)
function validateLicenseKey(keyString, fingerprint) {
  const stripped = keyString.replace(/[-\s]/g, '').toUpperCase();
  // Expected: "FNOTAIRE" prefix (8 chars) + 22 payload chars = 30
  const prefix = stripped.slice(0, 8);
  if (prefix !== 'FNOTAIRE') return { valid: false, reason: 'CLE_INVALIDE' };

  const payloadB32 = stripped.slice(8);
  if (payloadB32.length < 22) return { valid: false, reason: 'CLE_INVALIDE' };

  let raw;
  try {
    raw = base32Decode(payloadB32.slice(0, 22));
  } catch {
    return { valid: false, reason: 'CLE_INVALIDE' };
  }

  if (raw.length < 14) return { valid: false, reason: 'CLE_INVALIDE' };

  const type = raw[0];
  if (type !== 0x01 && type !== 0x02) return { valid: false, reason: 'CLE_INVALIDE' };

  const issueDays = raw.readUInt32BE(1);
  const customerId = raw.readUInt16BE(5);
  const storedHmac = raw.slice(7, 14); // 7 bytes

  // Recompute HMAC
  const payload = Buffer.concat([
    Buffer.from([type]),
    raw.slice(1, 7),
    Buffer.from(fingerprint, 'utf8'),
  ]);
  const computed = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest();
  const computedTrunc = computed.slice(0, 7);

  if (!crypto.timingSafeEqual(storedHmac, computedTrunc)) {
    return { valid: false, reason: 'CLE_INVALIDE' };
  }

  const issueDate = new Date(issueDays * 86400000);
  let expiryDate = null;

  if (type === 0x02) {
    expiryDate = new Date(issueDate.getTime() + 365 * 86400000);
    if (expiryDate.getTime() < Date.now()) {
      return { valid: false, reason: 'LICENCE_EXPIREE', expiryDate, issueDate, customerId, type };
    }
  }

  return { valid: true, type, issueDate, expiryDate, customerId };
}

// ── Encrypted store ──
function getStore(fingerprint) {
  const Store = require('electron-store');
  return new Store({
    name: 'license',
    fileExtension: 'dat',
    encryptionKey: crypto
      .createHash('sha256')
      .update(`FCN_LICENSE_SALT_v1|${fingerprint}`)
      .digest('hex')
      .slice(0, 32),
  });
}

// ── Save license after successful activation ──
function saveLicense(rawKey, licenseResult) {
  const fingerprint = getMachineFingerprint();
  const store = getStore(fingerprint);
  store.set({
    activationKey: rawKey,
    licenseType: licenseResult.type,
    issueDate: licenseResult.issueDate instanceof Date
      ? licenseResult.issueDate.toISOString()
      : licenseResult.issueDate,
    expiryDate: licenseResult.expiryDate
      ? (licenseResult.expiryDate instanceof Date
          ? licenseResult.expiryDate.toISOString()
          : licenseResult.expiryDate)
      : null,
    customerId: licenseResult.customerId,
    fingerprint,
  });
}

// ── Load and validate stored license ──
function loadAndValidateLicense() {
  const fingerprint = getMachineFingerprint();
  let store;
  try {
    store = getStore(fingerprint);
  } catch {
    return null;
  }

  const savedKey = store.get('activationKey');
  const savedFingerprint = store.get('fingerprint');

  if (!savedKey) return null;

  if (savedFingerprint && savedFingerprint !== fingerprint) {
    return { valid: false, reason: 'MACHINE_DIFFERENTE' };
  }

  return validateLicenseKey(savedKey, fingerprint);
}

module.exports = {
  getMachineFingerprint,
  validateLicenseKey,
  saveLicense,
  loadAndValidateLicense,
  SECRET_KEY,
  base32Encode,
  base32Decode,
};
