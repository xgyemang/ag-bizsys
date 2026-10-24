# MONO / Phone-first shop application

## 1. Files
- `index.html` — user interface, navigation and SVG icons
- `styles.css` — premium monochrome responsive design
- `app.js` — API client, state management, account roles and transaction flow
- `config.js` — one TEST API URL and public shop-name/environment settings

This frontend uses the **approved existing** Google Apps Script actions. No backend changes and no extra database columns are needed.

## 2. Install into a TEST GitHub Pages repository
1. Extract the ZIP file. Open `config.js` in a text editor.
2. Replace only `PASTE_TEST_APPS_SCRIPT_EXEC_URL_HERE` with your **deployed TEST** Apps Script Web App URL ending in `/exec`. No other code needs editing.
3. Keep `ENVIRONMENT: 'TEST'` and confirm the URL identifies the TEST spreadsheet. Never put a PIN, session token, password or spreadsheet secret in `config.js`.
4. Upload **all four files in the same directory** in your test GitHub repository. If Pages hosts the repository root, use the root directory.
5. In GitHub, go to **Settings → Pages → Build and deployment → Deploy from a branch**, select the correct branch and `/ (root)`, then save.
6. Open the published `https://...github.io/...` page, sign in using the configured TEST account and TEST PIN. Use disposable products and disposable test wallet amounts only.
7. Confirm the page header says **TEST**. Do not share or use this TEST deployment for actual customer sales.

The API must already accept browser POST requests and deliver readable JSON, as verified in Gate 2. Browsers can still block an altered deployment; if so use the network tools to verify the exact endpoint.

## 3. API contract implemented

All requests are POST JSON bodies through `text/plain;charset=utf-8` with `{action, token, requestId, payload}`.

| UI workflow | Backend action | Payload |
|--|--|--|
| Login | `login` | `{username,pin}` |
| Sign out | `logout` | `{}` |
| Catalogue/stock | `products` | `{}` |
| Owner wallet view | `balances` | `{}` |
| Sales history (last 30 sale-line records) | `history` | `{}` |
| Sell | `sale` | `{lines:[{itemId,quantity}],payments:[{wallet,amount}]}` |
| Owner restock | `restock` | `{itemId,quantity,unitCost,wallet}` |
| Owner expense | `expense` | `{category,amount,wallet,description}` |
| Owner capital | `capital` | `{type,amount,wallet,description}` |
| Owner transfer | `transfer` | `{from,to,amount}` |
| Owner stock loss | `stockLoss` | `{itemId,type,quantity,note}` |

Prices and financial calculations displayed on the phone are informational. Server-side values remain authoritative. No support for credit sales or multi-location transfers is implied. There is no "create item" API, so initial product creation remains an authorized spreadsheet setup task.

## 4. Important behavior
- One secure `requestId` per new business operation; on network timeout and retry, the same payload and ID are preserved.
- Only one unresolved operation per browser session; new writes are blocked until resolved. The user is advised to ask the owner for ledger investigation if recovery is required.
- Cart and the unresolved request are stored locally to survive accidental reload. The PIN is never stored. A session token is stored locally to restore the session; use a trusted shop device. Sign out when changing staff.
- On a response of `Recovery required`, the frontend retains the pending request. The owner must run the already approved backend recovery function/process before retrying.
- No success confirmation until the backend responds `{ok:true}`.
- Only owners see wallet balances or management actions, and backend authorization remains authoritative.
- API supplies no profit/daily-sales aggregates, so no fictitious financial dashboard totals are presented.
- History shows only the latest 30 committed sales-line records supplied by `history`.
- Supports system `prefers-reduced-motion` setting.

## 5. TEST acceptance checklist (record Pass/Fail and screenshot/log)

### Authentication
- [ ] Login with correct TEST owner PIN; products and owner wallets load.
- [ ] Bad PIN yields a clear error, no access.
- [ ] Login with TEST staff PIN; financial panel and owner actions are absent.
- [ ] Session expiry sends the user back to login.
- [ ] Logout revokes access on the screen and invokes backend logout.

### Sales and ledger integrity
- [ ] Search a disposable product and create one Cash sale. Compare sale, stock −quantity, wallet +amount and transaction ID against TEST spreadsheet.
- [ ] Create one MoMo sale; check wallet and stock postings.
- [ ] Create a two-method payment sale (e.g., Cash + MoMo). Total must reconcile, and exactly one sale is recorded.
- [ ] Reject a quantity larger than available stock; no additional ledger effects.
- [ ] Rapidly tap Confirm twice: exactly one new transaction ID and no duplicate effect.
- [ ] Simulate a browser request timeout AFTER server commit. Use the interface's **Retry safely** option; it must reuse the same ID and not create a second sale. Check ledger.
- [ ] Reload with an unresolved request: the app must show recovery workflow before accepting another write.

### Owner features
- [ ] Restock increases stock and decreases selected wallet once; does not create an operating expense.
- [ ] Expense decreases selected wallet once; appears in Expense Ledger.
- [ ] Capital contribution/withdrawal moves the wallet; not new revenue or expense.
- [ ] Wallet transfer posts equal-and-opposite movements.
- [ ] Damage/loss deducts stock and records cost effect once.
- [ ] Staff direct API attempt against an owner action is rejected by backend (the earlier Gate 2 security tests already cover this).

### Browser quality
- [ ] Check viewport widths ~360, 390, 768 and 1280 CSS pixels for overflow and touchability.
- [ ] Inspect light-screen contrast, focus indicators, error and empty states.
- [ ] Verify keyboard navigation and accessible control labels.
- [ ] Enable reduced motion and confirm animations stop.
- [ ] On weak/mobile connectivity verify timeout and retry message.
- [ ] Confirm the published TEST origin can read deployed TEST API JSON.

## 6. Evidence status
Local syntax and mock-browser tests can be run without posting to Google. **Real TEST spreadsheet end-to-end tests are still required** after inserting the deployed TEST API URL and TEST account. No live integration passes should be claimed from mock results.

## 7. Production promotion (after Judge approval only)
Use a separate production deployment/branch with the production `/exec` URL, and change the public environment label. Verify production account/security settings and perform the approved controlled go-live sale and reconciliation. Do not copy TEST passwords or TEST transaction records into production.

## v1.1 targeted safety corrections (TEST deployment)

### Before upload — verify Bank availability
1. In the **TEST ONLY** spreadsheet, open the `Settings` tab and find `BANK_WALLET_ENABLED`.
2. Open `config.js` in a plain text editor. Set `BANK_WALLET_ENABLED: true` **only if** the spreadsheet setting is exactly `true`; otherwise leave it `false`.
3. This is an **explicit deployment setting**, not an API response field. The existing backend returns Bank balances even when Bank operations are disabled; inferring enablement from `balances.wallets.Bank` would therefore be incorrect.
4. No backend edits or new API actions are necessary. Recheck this toggle whenever the TEST or live spreadsheet configuration changes.

### Safe pending transaction resolution
- A transaction with uncertain outcome is saved locally with its original request ID, action, payload and originating normalized username (never PIN). Session expiry and logout do **not** delete it.
- After signing in again as the **same username**, MONO offers **Check transaction → Retry safely**. This sends the original payload/request ID using the newly authenticated token, relying on backend idempotency. Do not start a new sale to compensate for a timeout.
- A different account may log in but cannot retry or enter another transaction on that browser until the original account signs in and resolves its request. Do not share browser profiles between staff for privacy; the pending payload is stored in the device browser's localStorage. Use device access controls.
- Old v1.0 pending records that only contain an expired session token have **no verifiable durable username**. They are blocked rather than reassigned. Contact the owner to reconcile the original request ID in the Transaction Registry manually; do not delete the pending entry or remake the sale.
- Clearing site/browser data destroys the saved pending record, so do not clear it while a request is unresolved. Backend transaction IDs remain authoritative.

### Targeted TEST checklist
- [ ] With TEST Bank disabled, login as owner and staff: Bank is absent from sale methods and split fields; owner wallet overview, restock, expense, capital, and transfer forms omit Bank.
- [ ] With TEST Bank enabled, and `config.js` set to `true`, Bank appears; verify a disposable TEST operation against the TEST wallet ledger.
- [ ] In a disposable TEST sale, simulate dropped/aborted response after a request ID was saved. Sign out or allow the session to expire. Sign back in using the original account; verify the request ID and payload are unchanged on safe retry and no second sale is recorded.
- [ ] Sign in as another TEST account while the pending request exists: no write or retry should be permitted. Return to the original account and reconcile.
- [ ] Verify original 4-tab navigation, responsive styles and owner-only controls still operate.

The test checklist above requires actual browser/API execution; local syntax and source checks do not substitute for integration tests.
