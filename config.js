// Copy the TEST deployment /exec URL here. No PINs or credentials in this file.
// BANK_WALLET_ENABLED MUST be the same boolean as the isolated TEST spreadsheet's
// Settings tab value. If uncertain, keep false (Bank is hidden, never guessed).
// The current backend deliberately does not return a wallet-availability field.
window.MONO_CONFIG = Object.freeze({
  API_URL: 'PASTE_TEST_APPS_SCRIPT_EXEC_URL_HERE',
  SHOP_NAME: 'GlepsyiCarePro',
  ENVIRONMENT: 'TEST',
  BANK_WALLET_ENABLED: false
});
