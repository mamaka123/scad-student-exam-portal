/* ==========================================================================
   TOTP JS - RFC 6238 Time-based One-Time Password & 2FA Engine
   Supports: Google Authenticator, Microsoft Authenticator, Authy
   Pure JavaScript Implementation (RFC 3174 SHA-1 + RFC 2104 HMAC + RFC 6238 TOTP)
   ========================================================================== */

(function(window) {
  'use strict';

  // Base32 Character Set (RFC 4648)
  const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  // Pure JavaScript SHA-1 (RFC 3174)
  function sha1(bytes) {
    function rotl(n, s) { return (n << s) | (n >>> (32 - s)); }
    const len = bytes.length;
    const bitLen = len * 8;
    const newLen = (((len + 8) >> 6) + 1) * 64;
    const padded = new Uint8Array(newLen);
    padded.set(bytes);
    padded[len] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(newLen - 4, bitLen, false);

    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    const w = new Uint32Array(80);

    for (let i = 0; i < newLen; i += 64) {
      for (let j = 0; j < 16; j++) {
        w[j] = view.getUint32(i + (j * 4), false);
      }
      for (let j = 16; j < 80; j++) {
        w[j] = rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
      }

      let a = h0, b = h1, c = h2, d = h3, e = h4;
      for (let j = 0; j < 80; j++) {
        let f, k;
        if (j < 20) { f = (b & c) | ((~b) & d); k = 0x5a827999; }
        else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
        else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
        else { f = b ^ c ^ d; k = 0xca62c1d6; }

        const temp = (rotl(a, 5) + f + e + k + w[j]) >>> 0;
        e = d; d = c; c = rotl(b, 30); b = a; a = temp;
      }

      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
    }

    const out = new Uint8Array(20);
    const outView = new DataView(out.buffer);
    outView.setUint32(0, h0, false);
    outView.setUint32(4, h1, false);
    outView.setUint32(8, h2, false);
    outView.setUint32(12, h3, false);
    outView.setUint32(16, h4, false);
    return out;
  }

  // Pure JavaScript HMAC-SHA1 (RFC 2104)
  function hmacSha1(keyBytes, messageBytes) {
    let key = keyBytes;
    if (key.length > 64) {
      key = sha1(key);
    }
    const paddedKey = new Uint8Array(64);
    paddedKey.set(key);

    const oPad = new Uint8Array(64);
    const iPad = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      oPad[i] = paddedKey[i] ^ 0x5c;
      iPad[i] = paddedKey[i] ^ 0x36;
    }

    const inner = new Uint8Array(64 + messageBytes.length);
    inner.set(iPad);
    inner.set(messageBytes, 64);
    const innerHash = sha1(inner);

    const outer = new Uint8Array(64 + 20);
    outer.set(oPad);
    outer.set(innerHash, 64);
    return sha1(outer);
  }

  // Base32 Decode
  function base32Decode(base32) {
    const clean = (base32 || '').toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
    let bits = 0, value = 0, index = 0;
    const output = new Uint8Array(Math.floor(clean.length * 5 / 8));
    for (let i = 0; i < clean.length; i++) {
      const val = BASE32_ALPHABET.indexOf(clean[i]);
      if (val === -1) continue;
      value = (value << 5) | val;
      bits += 5;
      if (bits >= 8) {
        output[index++] = (value >>> (bits - 8)) & 255;
        bits -= 8;
      }
    }
    return output;
  }

  // Base32 Encode
  function base32Encode(bytes) {
    let bits = 0, value = 0, output = '';
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
  }

  class TOTPService {
    constructor() {
      this.period = 30;
      this.digits = 6;
      this.issuer = 'SCAD-LMS';
      this.defaultUser = 'kasivishal';
    }

    /**
     * Generate cryptographically secure Base32 secret key (16 characters / 80 bits)
     */
    generateSecret(length = 16) {
      const bytes = new Uint8Array(Math.ceil((length * 5) / 8));
      if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(bytes);
      } else {
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = Math.floor(Math.random() * 256);
        }
      }
      return base32Encode(bytes).slice(0, length);
    }

    /**
     * Format secret for display (e.g. "JBSW Y3DP EHPK 3PXP")
     */
    formatSecret(secret) {
      const clean = (secret || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
      return clean.match(/.{1,4}/g)?.join(' ') || clean;
    }

    /**
     * Generate standard otpauth URL for QR Code scanner
     */
    getOtpAuthUrl(secret, account = 'kasivishal', issuer = 'SCAD-LMS') {
      const cleanSecret = (secret || '').toUpperCase().replace(/\s+/g, '');
      const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
      return `otpauth://totp/${label}?secret=${cleanSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${this.digits}&period=${this.period}`;
    }

    /**
     * Get high-quality QR code image URL (Google Chart & QRServer compatible)
     */
    getQrCodeUrl(otpAuthUrl, size = 220) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(otpAuthUrl)}&margin=8&qzone=1`;
    }

    getFallbackQrUrl(otpAuthUrl, size = 220) {
      return `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(otpAuthUrl)}&choe=UTF-8`;
    }

    /**
     * Calculate 6-digit TOTP code for a secret at a specific timestamp (RFC 6238)
     */
    generateCode(secret, timeSec = Math.floor(Date.now() / 1000)) {
      if (!secret) return '';
      const keyBytes = base32Decode(secret);
      const counter = Math.floor(timeSec / this.period);
      const buf = new Uint8Array(8);
      const view = new DataView(buf.buffer);
      view.setUint32(0, Math.floor(counter / 0x100000000), false);
      view.setUint32(4, counter >>> 0, false);

      const hmac = hmacSha1(keyBytes, buf);
      const offset = hmac[19] & 0x0f;
      const code = ((hmac[offset] & 0x7f) << 24) |
                   ((hmac[offset + 1] & 0xff) << 16) |
                   ((hmac[offset + 2] & 0xff) << 8) |
                   (hmac[offset + 3] & 0xff);
      return (code % 1000000).toString().padStart(this.digits, '0');
    }

    /**
     * Verify user-entered token against secret with clock drift window (+/- 30s)
     */
    verifyCode(token, secret, windowSteps = 1) {
      if (!token || !secret) return false;
      const cleanToken = token.toString().replace(/[^0-9]/g, '').trim();
      if (cleanToken.length !== this.digits) return false;

      const cleanSecret = secret.toUpperCase().replace(/\s+/g, '');
      const currentTimeSec = Math.floor(Date.now() / 1000);

      // Check current window and +/- window steps for clock tolerance
      for (let i = -windowSteps; i <= windowSteps; i++) {
        const checkTime = currentTimeSec + (i * this.period);
        const validCode = this.generateCode(cleanSecret, checkTime);
        if (cleanToken === validCode) {
          return true;
        }
      }
      return false;
    }

    /**
     * Seconds remaining in current 30-second TOTP cycle
     */
    getSecondsRemaining() {
      const now = Math.floor(Date.now() / 1000);
      return this.period - (now % this.period);
    }
  }

  const totpService = new TOTPService();
  window.totpService = totpService;

  class SuperAdmin2FAController {
    constructor() {
      this.currentSecret = (typeof DEFAULT_SUPER_ADMIN_2FA_SECRET !== 'undefined') ? DEFAULT_SUPER_ADMIN_2FA_SECRET : 'SCADKASIVISHAL26';
      this.timerInterval = null;
      this.mode = 'verify'; // 'setup' or 'verify'
    }

    init(forceSetup = false) {
      this.clearInterval();
      const defaultSecret = (typeof DEFAULT_SUPER_ADMIN_2FA_SECRET !== 'undefined')
        ? DEFAULT_SUPER_ADMIN_2FA_SECRET
        : 'SCADKASIVISHAL26';
      const cfg = window.storage && typeof storage.getSuperAdmin2FAConfig === 'function'
        ? storage.getSuperAdmin2FAConfig()
        : null;

      this.currentSecret = (cfg && cfg.secret) ? cfg.secret : defaultSecret;

      if (forceSetup) {
        this.showSetupCard(false);
      } else {
        this.showVerifyCard();
      }
    }

    showVerifyCard() {
      this.mode = 'verify';
      const setupCard = document.getElementById('super-2fa-setup-card');
      const verifyCard = document.getElementById('super-2fa-verify-card');
      if (setupCard) setupCard.style.display = 'none';
      if (verifyCard) verifyCard.style.display = 'block';

      this.startTimer();

      const input = document.getElementById('super-2fa-verify-input');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 250);
      }
    }

    showSetupCard(regenerate = false) {
      this.mode = 'setup';
      this.clearInterval();

      if (regenerate) {
        this.currentSecret = totpService.generateSecret(16);
      } else if (!this.currentSecret) {
        const defaultSecret = (typeof DEFAULT_SUPER_ADMIN_2FA_SECRET !== 'undefined') ? DEFAULT_SUPER_ADMIN_2FA_SECRET : 'SCADKASIVISHAL26';
        this.currentSecret = defaultSecret;
      }

      const setupCard = document.getElementById('super-2fa-setup-card');
      const verifyCard = document.getElementById('super-2fa-verify-card');
      if (setupCard) setupCard.style.display = 'block';
      if (verifyCard) verifyCard.style.display = 'none';

      // Render Secret Text
      const secretEl = document.getElementById('super-2fa-secret-text');
      if (secretEl) secretEl.textContent = totpService.formatSecret(this.currentSecret);

      // Render QR Code Image
      const otpAuthUrl = totpService.getOtpAuthUrl(this.currentSecret, 'kasivishal', 'SCAD-LMS');
      const qrImg = document.getElementById('super-2fa-qr-img');
      if (qrImg) {
        qrImg.src = totpService.getQrCodeUrl(otpAuthUrl);
        qrImg.onerror = () => {
          qrImg.src = totpService.getFallbackQrUrl(otpAuthUrl);
        };
      }

      const input = document.getElementById('super-2fa-setup-input');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 250);
      }
    }

    startTimer() {
      this.clearInterval();
      const update = () => {
        const remaining = totpService.getSecondsRemaining();
        const timerEl = document.getElementById('super-2fa-timer-sec');
        const barEl = document.getElementById('super-2fa-timer-bar');
        if (timerEl) timerEl.textContent = `${remaining}s`;
        if (barEl) {
          const pct = Math.max(0, Math.min(100, (remaining / 30) * 100));
          barEl.style.width = `${pct}%`;
          if (remaining <= 5) {
            barEl.style.background = '#ef4444';
          } else {
            barEl.style.background = '#f59e0b';
          }
        }
      };
      update();
      this.timerInterval = setInterval(update, 1000);
    }

    clearInterval() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    }

    handleVerify(e, type) {
      if (e) e.preventDefault();
      const inputId = type === 'setup' ? 'super-2fa-setup-input' : 'super-2fa-verify-input';
      const input = document.getElementById(inputId);
      const code = input ? input.value.trim() : '';

      try {
        const session = window.auth.verifySuperAdmin2FALogin(code, this.currentSecret);
        this.clearInterval();
        if (window.ui) {
          window.ui.showToast('✅ Two-Factor Authentication Verified! Welcome Kasivishal.', 'success');
          window.ui.showView('super-admin-view');
        }
        if (window.superAdminDashboard) {
          window.superAdminDashboard.init();
        }
        if (typeof window.renderGlobalAdSlots === 'function') {
          window.renderGlobalAdSlots();
        }
      } catch (err) {
        if (window.ui) {
          window.ui.showToast(err.message, 'error');
        } else {
          console.error(err.message);
        }
        if (input) {
          input.classList.add('input-shake');
          setTimeout(() => input.classList.remove('input-shake'), 600);
          input.focus();
        }
      }
    }

    autofillTestCode(type) {
      const liveCode = totpService.generateCode(this.currentSecret);
      const inputId = type === 'setup' ? 'super-2fa-setup-input' : 'super-2fa-verify-input';
      const input = document.getElementById(inputId);
      if (input) {
        input.value = liveCode;
        input.focus();
      }
      if (window.ui) {
        window.ui.showToast(`⚡ Autofilled Current Live OTP: ${liveCode}`, 'info');
      }
    }

    copySecret() {
      if (!this.currentSecret) return;
      navigator.clipboard.writeText(this.currentSecret).then(() => {
        if (window.ui) window.ui.showToast('📋 Secret Key copied to clipboard!', 'success');
      }).catch(() => {
        const el = document.getElementById('super-2fa-secret-text');
        if (el) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          if (window.ui) window.ui.showToast('Secret key selected, press Ctrl+C to copy', 'info');
        }
      });
    }

    reconfigure() {
      this.showSetupCard(false);
    }

    cancel() {
      this.clearInterval();
      if (window.ui) {
        window.ui.showView('admin-login-view');
      }
    }
  }

  window.superAdmin2FA = new SuperAdmin2FAController();
})(window);
