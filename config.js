// Copy the TEST deployment /exec URL here. No PINs or credentials in this file.
// BANK_WALLET_ENABLED MUST be the same boolean as the isolated TEST spreadsheet's
// Settings tab value. If uncertain, keep false (Bank is hidden, never guessed).
// The current backend deliberately does not return a wallet-availability field.
window.MONO_CONFIG = Object.freeze({
  API_URL: 'https://script.google.com/macros/s/AKfycbxxjo3XBwWR5EPRdk6wkBf35BcPhijYV2c6Mc2Z_GqgibxaOASC7e2xEfRZtP5bM3dS/exec',
  SHOP_NAME: 'MONO',
  ENVIRONMENT: 'TEST',
  BANK_WALLET_ENABLED: true
});
