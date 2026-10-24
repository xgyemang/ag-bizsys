// Copy the TEST deployment /exec URL here. No PINs or credentials in this file.
// BANK_WALLET_ENABLED MUST be the same boolean as the isolated TEST spreadsheet's
// Settings tab value. If uncertain, keep false (Bank is hidden, never guessed).
// The current backend deliberately does not return a wallet-availability field.
window.MONO_CONFIG = Object.freeze({
  API_URL: 'https://script.google.com/macros/s/AKfycbwrF-UiOnYbljeQ2hifKYJ5jGJ0K1zu56u8wyS7bE_9BANjuoxgPnsGX_tDlnzXyaLu/exec',
  SHOP_NAME: 'GlepsyiCarePro',
  ENVIRONMENT: 'TEST',
  BANK_WALLET_ENABLED: true
});
