/* GlepsyiCarePro / MONO frontend v1.2. No third-party runtime dependencies. */
'use strict';
(() => {
  const config=window.MONO_CONFIG||{};
  const API_URL=String(config.API_URL||''); // single API URL constant
  const MAX_WAIT=30000;
  const $=(id)=>document.getElementById(id);
  const state={token:null,role:null,expiry:0,tab:'home',items:[],balances:null,history:[],cart:new Map(),method:'Cash',split:{Cash:'',MoMo:'',Bank:''},filter:'',busy:false,loading:false,bank:config.BANK_WALLET_ENABLED===true,pending:null,username:null,pendingBlocked:false};
  const safeStore={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}},remove(k){try{localStorage.removeItem(k)}catch{}}};
  const CURRENCY=new Intl.NumberFormat('en-GH',{style:'currency',currency:'GHS',minimumFractionDigits:2,maximumFractionDigits:2});
  const money=(v)=>CURRENCY.format(Number(v)||0).replace('GHS','GH₵');
  const id=()=>{
    if(!globalThis.crypto||!crypto.randomUUID)throw Error('A secure browser connection is required to generate transaction IDs');
    return 'mono_'+crypto.randomUUID().replaceAll('-','');
  };
  const svg=(name)=>{const el=document.createElementNS('http://www.w3.org/2000/svg','svg');el.classList.add('icon');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#i-'+name);el.append(use);return el};
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined&&text!==null)el.textContent=String(text);return el};
  const button=(text,cls,fn,icon)=>{const b=node('button',cls);b.type='button';b.append(document.createTextNode(text));if(icon)b.append(svg(icon));b.addEventListener('click',fn);return b};
  const clear=(el)=>el.replaceChildren();
  function loadingRows(root,count=4){const list=node('div','list-panel skeleton-panel');list.setAttribute('aria-label','Loading shop data');for(let i=0;i<count;i++){const row=node('div','skeleton-row');row.append(node('div','skeleton-block skeleton-avatar'),node('div','skeleton-copy'));const copy=row.lastChild;copy.append(node('div','skeleton-block skeleton-title'),node('div','skeleton-block skeleton-subtitle'));row.append(node('div','skeleton-block skeleton-amount'));list.append(row)}root.append(list)}
  function showLoading(){if(!sessionValid())return;const main=$('mainContent');clear(main);main.append(page(state.tab==='activity'?'Loading activity…':state.tab==='stock'?'Loading inventory…':state.tab==='sell'?'Preparing checkout…':'Preparing your shop…','Fetching the latest information.','GLEPSYICAREPRO / SYNC'));loadingRows(main,state.tab==='home'?3:5)}
  const apiConfigured=()=>/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(API_URL);
  const sessionValid=()=>state.token&&Date.now()<state.expiry-10000;
  const setOperation=(message)=>{const box=$('operationStatus');if(!box)return;box.hidden=!message; if(message)$('operationStatusText').textContent=message;};
  const banner=(msg)=>{const el=$('toast');el.textContent=msg;el.hidden=false;clearTimeout(banner.timer);banner.timer=setTimeout(()=>el.hidden=true,6000)};
  function normalError(err){if(err.name==='AbortError')return 'The request timed out. It may still have been recorded.';if(/Failed to fetch|NetworkError|Load failed/i.test(err.message))return 'Network problem. The request outcome is not confirmed.';return err.message||'Something went wrong.'}
  async function api(action,payload={},requestId,overrideToken){
    if(!apiConfigured())throw Error('Set the TEST API URL in config.js before using MONO.');
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),MAX_WAIT);
    try{
      const res=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token:overrideToken===undefined?state.token:overrideToken,requestId:requestId||undefined,payload}),redirect:'follow',signal:ctl.signal,cache:'no-store'});
      if(!res.ok)throw Error('API returned HTTP '+res.status);
      const raw=await res.text();let data;try{data=JSON.parse(raw)}catch{throw Error('API response could not be read as JSON');}
      if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Unexpected API response');
      if(data.ok!==true)throw Error(String(data.error||'Request rejected'));
      return data;
    }finally{clearTimeout(timer)}
  }
  const normalizeUsername=(s)=>String(s||'').trim().toLowerCase();
  // No settings endpoint exists. This verified TEST configuration is mirrored from
  // Settings!BANK_WALLET_ENABLED, and defaults to disabled if unspecified.
  const wallets=()=>state.bank?['Cash','MoMo','Bank']:['Cash','MoMo'];
  function ensureWalletSelection(){
    if(!wallets().includes(state.method))state.method='Cash';
    if(!state.bank)state.split.Bank='';
  }
  function readPending(){
    try{const p=JSON.parse(safeStore.get('mono_pending')||'null');
      if(p&&typeof p.requestId==='string'&&typeof p.action==='string'&&p.payload&&typeof p.payload==='object')return p;
    }catch{}return null;
  }
  function syncPendingForAccount(){
    const p=readPending();state.pending=null;state.pendingBlocked=false;
    if(!p)return;
    if(p.username&&p.username===state.username){state.pending=p;return;}
    // Legacy v1.0 records did not contain a durable account identity. Only
    // migrate if the old session token still matches; otherwise fail closed.
    if(!p.username&&p.ownerToken&&p.ownerToken===state.token&&state.username){
      state.pending={requestId:p.requestId,action:p.action,payload:p.payload,username:state.username,createdAt:p.createdAt};
      safeStore.set('mono_pending',JSON.stringify(state.pending));return;
    }
    state.pendingBlocked=true;
  }
  function rememberSession(d,username){
    state.token=d.token;state.role=d.role;state.expiry=Date.parse(d.expiresAt);
    state.username=normalizeUsername(username);
    safeStore.set('mono_session',JSON.stringify({token:state.token,role:state.role,expiry:state.expiry,username:state.username}));
    syncPendingForAccount();
  }
  function logoutLocal(){
    state.token=null;state.role=null;state.expiry=0;state.username=null;
    state.items=[];state.balances=null;state.history=[];state.cart.clear();state.pending=null;
    state.pendingBlocked=!!readPending();
    safeStore.remove('mono_session');safeStore.remove('mono_cart');
    $('workspace').hidden=true;$('loginScreen').hidden=false;$('pin').value='';$('loginError').hidden=true;
    if(state.pendingBlocked) $('loginError').textContent='A previous transaction still needs verification. Sign in with the original account to resolve it.';
  }
  async function logout(){
    if(state.busy)return;
    const token=state.token;logoutLocal();
    if(token)try{await api('logout',{},undefined,token)}catch{}
  }
  function authError(err){
    if(/Unauthorized|session expired/i.test(err.message)){
      logoutLocal();banner('Session expired. Sign in with the original account to resolve any pending request.');return true;
    }return false;
  }
  function savePending(){
    if(state.pending)safeStore.set('mono_pending',JSON.stringify(state.pending));
    else safeStore.remove('mono_pending');
    state.pendingBlocked=false;
  }
  function restoreSaved(){
    try{const s=JSON.parse(safeStore.get('mono_session')||'null');
      if(s&&typeof s.token==='string'&&['owner','staff'].includes(s.role)&&s.expiry>Date.now()+10000&&s.username){
        state.token=s.token;state.role=s.role;state.expiry=s.expiry;state.username=normalizeUsername(s.username);
      }
    }catch{}
    syncPendingForAccount();
    try{const c=JSON.parse(safeStore.get('mono_cart')||'[]');if(Array.isArray(c))c.forEach(x=>{if(typeof x[0]==='string'&&Number.isSafeInteger(x[1])&&x[1]>0)state.cart.set(x[0],x[1])})}catch{}
  }
  function guardPending(){
    if(state.pendingBlocked){banner('Another account has an unresolved request. Sign out and use the original account.');return true;}
    if(state.pending){openPending();return true;}
    return false;
  }
  function saveCart(){safeStore.set('mono_cart',JSON.stringify([...state.cart]));}
  async function refresh(opts={}){
    if(!sessionValid()){logoutLocal();return}
    if(state.loading)return;
    state.loading=true;
    showLoading();
    try{
      const product=await api('products');state.items=Array.isArray(product.items)?product.items:[];
      ensureWalletSelection();
      if(state.role==='owner'){
        const balances=await api('balances');state.balances=balances.wallets||{};
      }
      if(opts.withHistory||state.tab==='activity'){
        const history=await api('history');state.history=Array.isArray(history.sales)?history.sales:[];
      }
      render();
    }catch(err){if(!authError(err))showLoadError(err)}finally{state.loading=false}
  }
  function showLoadError(err){const main=$('mainContent');clear(main);main.append(node('div','inline-notice error',normalError(err)),button('Try again','btn btn-dark',()=>refresh({withHistory:true}),'refresh'));}
  function page(title,subtitle,kicker){const frag=document.createDocumentFragment();const head=node('div','page-head');const info=node('div');info.append(node('div','eyebrow',kicker||'YOUR WORKSPACE'),node('h1','',title));if(subtitle)info.append(node('p','page-sub',subtitle));head.append(info);frag.append(head);return frag}
  function section(title,action){const bar=node('div','section-heading');bar.append(node('h2','',title));if(action)bar.append(action);return bar}
  function itemRow(item,onPick,meta){const row=node('div','line-item');const left=node('div');left.style.cssText='display:flex;align-items:center;gap:12px;min-width:0';left.append(node('div','item-icon','◧'));const detail=node('div');detail.style.minWidth='0';detail.append(node('div','item-title',item.name),node('div','item-desc',meta===undefined?item.id+' · '+item.stock+' in stock':meta));left.append(detail);row.append(left);const right=node('div','item-right');right.append(node('strong','',money(item.price)));if(onPick){const b=button('Add','btn btn-light',onPick,'plus');b.style.marginLeft='10px';b.disabled=item.stock<=0;right.append(b)}else{right.append(node('div','item-desc',item.stock+' available'))}row.append(right);return row}
  function empty(message){const el=node('div','empty');el.append(svg('box'),node('p','',message));return el}
  function makeHeaderAction(text,fn){const b=button(text,'btn btn-dark',fn,'arrow');return b}
  function render(){if(!sessionValid()){logoutLocal();return}const main=$('mainContent');clear(main);document.querySelectorAll('[data-nav]').forEach(x=>{x.classList.toggle('active',x.dataset.nav===state.tab);x.setAttribute('aria-current',x.dataset.nav===state.tab?'page':'false')});if(state.tab==='home')renderHome(main);if(state.tab==='sell')renderSell(main);if(state.tab==='stock')renderStock(main);if(state.tab==='activity')renderActivity(main)}
  function renderHome(main){
    const head=page('Good to see you.','Your shop, at a glance.','GLEPSYICAREPRO / OVERVIEW');head.querySelector('.page-head').append(makeHeaderAction('New sale',()=>navigate('sell')));main.append(head);
    if(state.pendingBlocked){const warn=node('div','inline-notice warn','A transaction from another account remains unresolved on this device. Sign in with that account before entering new transactions.');main.append(warn)}
    if(state.pending){const notice=node('div','inline-notice warn','A previous request may be unresolved. Retry it safely before entering a different transaction.');notice.append(button('Resolve request','btn btn-quiet',()=>openPending()));main.append(notice)}
    const hero=node('div','hero'),info=node('div');info.append(node('div','eyebrow','YOUR SHOP. IN CONTROL.'),node('h2','','Ready for the next sale?'),node('p','','Less tapping, more serving. Record a sale in moments.'));hero.append(info,makeHeaderAction('Start a sale',()=>navigate('sell')));main.append(hero);
    main.append(section('Shop snapshot'));const stats=node('div','stats');
    const records=state.items.reduce((sum,x)=>sum+Math.max(0,Number(x.stock)||0),0);const low=state.items.filter(x=>Number(x.stock)<=3).length;
    [['Products',state.items.length,'Active products'],['Units in stock',records,'Across your catalogue'],['Low stock',low,'3 units or less']].forEach(([label,val,hint])=>{const box=node('div','stat');box.append(node('div','stat-label',label),node('div','stat-value',val),node('div','stat-note',hint));stats.append(box)});main.append(stats);
    if(state.role==='owner'){
      main.append(section('Money overview'));const grid=node('div','wallet-grid');wallets().forEach(name=>{const b=node('div','big-wallet');b.append(node('div','pill',name),node('div','balance-large',money(state.balances?.[name]||0)));grid.append(b)});main.append(grid);
      main.append(section('Manage your business'));const actions=node('div','management-list');[['Record expense','expense'],['Restock products','restock'],['Capital in or out','capital'],['Move money','transfer'],['Damaged or lost stock','stockLoss']].forEach(([label,action])=>actions.append(button(label,'management-action',()=>openAction(action),'chevron')));main.append(actions);
      const negative=wallets().filter(w=>Number(state.balances?.[w])<0);if(negative.length)main.append(node('p','inline-notice warn','Negative wallet balance: '+negative.join(', ')+'. Reconcile your records.'));
    }
    const lowItems=state.items.filter(x=>x.stock<=3).slice(0,5);if(lowItems.length){main.append(section('Needs attention'));const list=node('div','list-panel');lowItems.forEach(x=>list.append(itemRow(x,null)));main.append(list)}
  }
  function navigate(tab){if(!['home','sell','stock','activity'].includes(tab)||state.busy)return;state.tab=tab;state.filter='';render();const main=$('mainContent');main.classList.remove('screen-enter');void main.offsetWidth;main.classList.add('screen-enter');window.scrollTo({top:0,behavior:'instant'});if(tab==='activity')refresh({withHistory:true})}
  function renderStock(main){main.append(page('Your inventory.','Check prices, availability and stock levels.','PRODUCTS / INVENTORY'));const s=node('label','search-box');s.append(svg('search'));const input=node('input');input.type='search';input.placeholder='Search products or item ID';input.setAttribute('aria-label','Search products');input.value=state.filter;s.append(input);main.append(s);const list=node('div','list-panel');list.style.marginTop='18px';main.append(list);function draw(){clear(list);const matches=state.items.filter(x=>(x.name+' '+x.id).toLowerCase().includes(state.filter.toLowerCase()));if(!matches.length)list.append(empty('No products match your search.'));else matches.forEach(x=>list.append(itemRow(x,null)))}input.addEventListener('input',()=>{state.filter=input.value;draw()});draw();if(state.role==='owner')main.append(section('Owner inventory actions'),button('Restock products','btn btn-quiet',()=>openAction('restock'),'plus'),button('Record stock loss','btn btn-quiet',()=>openAction('stockLoss'),'arrow'))}
  function addCart(item){if(guardPending())return;const current=state.cart.get(item.id)||0;if(current>=item.stock){banner('Not enough stock available');return}state.cart.set(item.id,current+1);saveCart();render()}
  function qtyChange(item,n){const next=(state.cart.get(item.id)||0)+n;if(next<=0)state.cart.delete(item.id);else if(next>item.stock){banner('Not enough stock available');return}else state.cart.set(item.id,next);saveCart();render()}
  function cartTotal(){let cents=0;state.cart.forEach((qty,key)=>{const x=state.items.find(i=>i.id===key);if(x)cents+=Math.round(Number(x.price)*100)*qty});return cents/100}
  function renderSell(main){main.append(page('Make a sale.','Choose items, then take payment.','SALES / CHECKOUT'));if(state.pendingBlocked){main.append(node('div','inline-notice warn','A pending transaction belongs to a different account. Sign out and use its original account.'));return}if(state.pending){main.append(node('div','inline-notice warn','An earlier transaction is unresolved. Finish checking it before a new sale.'),button('Resolve prior request','btn btn-dark',()=>openPending()));return}const grid=node('div','screen-grid'),left=node('div');const search=node('label','search-box');search.append(svg('search'));const inp=node('input');inp.type='search';inp.placeholder='Search your catalogue';inp.setAttribute('aria-label','Search products');inp.value=state.filter;search.append(inp);left.append(search);const products=node('div','list-panel');products.style.marginTop='17px';left.append(products);function draw(){clear(products);const matches=state.items.filter(x=>(x.name+' '+x.id).toLowerCase().includes(state.filter.toLowerCase()));if(!matches.length)products.append(empty('No matching products.'));else matches.forEach(x=>products.append(itemRow(x,()=>addCart(x))))}inp.addEventListener('input',()=>{state.filter=inp.value;draw()});draw();grid.append(left);
    const cart=node('section','cart-panel'),top=node('div','cart-top');top.append(node('h2','','Current sale'),node('div','pill',state.cart.size+' items'));cart.append(top);const lines=node('div','cart-items');if(!state.cart.size)lines.append(empty('Your basket is empty. Add a product to begin.'));state.cart.forEach((qty,key)=>{const item=state.items.find(x=>x.id===key);if(!item)return;const line=node('div','cart-row'),detail=node('div');detail.append(node('div','item-title',item.name),node('div','item-desc',money(item.price)+' each'));const control=node('div','qty-control');control.append(button('','',()=>qtyChange(item,-1),'minus'),node('strong','',qty),button('','',()=>qtyChange(item,1),'plus'));detail.append(control);line.append(detail,node('strong','',money(item.price*qty)));lines.append(line)});cart.append(lines,node('div','divider'));
    const total=node('div','totals-row');total.append(node('span','muted','Total to collect'),node('span','total-amount',money(cartTotal())));cart.append(total);
    cart.append(node('div','item-title','Payment method'));const payment=node('div','payment-grid');[...wallets(),'Split'].forEach(w=>{const b=button(w,'payment-option'+(state.method===w?' selected':''),()=>{state.method=w;render()});payment.append(b)});cart.append(payment);
    if(state.method==='Split'){const split=node('div','payment-split');wallets().forEach(w=>{const f=node('div','field'),label=node('label','',w),input=node('input');input.type='number';input.min='0';input.step='0.01';input.inputMode='decimal';input.placeholder='0.00';input.value=state.split[w];input.addEventListener('input',()=>{state.split[w]=input.value});f.append(label,input);split.append(f)});cart.append(split)}
    const checkout=button('Record sale','btn btn-dark btn-full',checkoutSale,'arrow');checkout.disabled=!state.cart.size||state.busy;checkout.style.marginTop='22px';cart.append(checkout,node('p','field-help','Final totals and stock availability are checked by the server.'));grid.append(cart);main.append(grid)
  }
  function paymentPlan(total){ensureWalletSelection();if(state.method!=='Split')return [{wallet:state.method,amount:total}];const pays=[];let sum=0;for(const w of wallets()){const raw=state.split[w];if(raw==='')continue;const n=Number(raw);if(!Number.isFinite(n)||n<0||Math.abs(n*100-Math.round(n*100))>0.000001)throw Error('Payment amounts must be valid to two decimals.');if(n>0){pays.push({wallet:w,amount:n});sum+=Math.round(n*100)}}if(pays.length<1||Math.round(total*100)!==sum)throw Error('Split payments must equal the sale total exactly.');return pays}
  function checkoutSale(){if(guardPending())return;if(!state.cart.size)return;const total=cartTotal();let pays;try{pays=paymentPlan(total)}catch(err){banner(err.message);return}const lines=[...state.cart].map(([itemId,quantity])=>({itemId,quantity}));openConfirm('Confirm sale',money(total),'This sale will deduct stock and record '+pays.map(x=>x.wallet+' '+money(x.amount)).join(' + ')+'.',()=>performWrite('sale',{lines,payments:pays},'Sale recorded',()=>{state.cart.clear();saveCart();state.split={Cash:'',MoMo:'',Bank:''};state.tab='home'}))}
  function renderActivity(main){main.append(page('Activity.','Your latest committed sales.','HISTORY / RECORDS'));const info=node('div','inline-notice','Shows the latest 30 committed sale line records returned by the backend. It is not a complete accounting journal.');main.append(info);main.append(section('Recent sales',button('Refresh','text-button',()=>refresh({withHistory:true}),'refresh')));const panel=node('div','list-panel');if(!state.history.length)panel.append(empty('No recent sales to show.'));else [...state.history].reverse().forEach(x=>{const row=node('div','line-item');const left=node('div');left.append(node('div','item-title',String(x.item||'Product')),node('div','item-desc',new Date(x.timestamp).toLocaleString('en-GH')+' · Qty '+x.quantity),node('div','item-desc','Transaction '+x.transactionId));row.append(left,node('div','item-right',money(x.total)));panel.append(row)});main.append(panel)}
  function closeDialog(){clear($('dialog'));$('overlay').hidden=true}
  function openDialog(title){const overlay=$('overlay'),dialog=$('dialog');clear(dialog);overlay.hidden=false;const header=node('div','dialog-head');header.append(node('h2','',title));header.append(button('','dialog-close',closeDialog,'x'));dialog.append(header);return dialog}
  function openConfirm(title,amount,explain,onYes){const d=openDialog(title);const large=node('h2','balance-large',amount);large.style.marginBottom='14px';d.append(large,node('p','muted',explain));const actions=node('div','dialog-actions');actions.append(button('Cancel','btn btn-quiet',closeDialog),button('Confirm','btn btn-dark',()=>{closeDialog();onYes()},'check'));d.append(actions)}
  function field(form,name,label,type,options){const wrap=node('div','field'),lab=node('label','',label),el=options?document.createElement('select'):document.createElement('input');el.name=name;el.id='field_'+name;lab.htmlFor=el.id;if(options){options.forEach(v=>{const o=node('option','',v);o.value=v;el.append(o)})}else{el.type=type||'text';if(el.type==='number'){el.step=name==='quantity'?'1':'0.01';el.min='0';el.inputMode='decimal'}el.required=true;}wrap.append(lab,el);form.append(wrap);return el}
  function openAction(action){if(state.role!=='owner')return banner('Owner access is required.');if(guardPending())return;const names={restock:'Add new stock',expense:'Record an expense',capital:'Owner capital',transfer:'Move between wallets',stockLoss:'Record a stock loss'};const d=openDialog(names[action]);const form=node('form');form.autocomplete='off';const productOptions=state.items.map(x=>({value:x.id,name:x.name}));function productField(){const wrap=node('div','field');wrap.append(node('label','', 'Product'));const sel=node('select');sel.name='itemId';sel.required=true;productOptions.forEach(x=>{const o=node('option','',x.name+' · '+x.id);o.value=x.value;sel.append(o)});wrap.append(sel);form.append(wrap)}
    if(action==='restock'){productField();field(form,'quantity','Quantity','number');field(form,'unitCost','Unit cost (GH₵)','number');field(form,'wallet','Pay from',null,wallets())}
    if(action==='expense'){field(form,'category','Category',null,['Rent','Utilities','Transport','Internet','Packaging','Salaries','Repairs','Other']);field(form,'amount','Amount (GH₵)','number');field(form,'wallet','Pay from',null,wallets());field(form,'description','Description','text')}
    if(action==='capital'){field(form,'type','Transaction type',null,['Contribution','Withdrawal']);field(form,'amount','Amount (GH₵)','number');field(form,'wallet','Wallet',null,wallets());field(form,'description','Description','text')}
    if(action==='transfer'){field(form,'from','From wallet',null,wallets());field(form,'to','To wallet',null,wallets().slice().reverse());field(form,'amount','Amount (GH₵)','number')}
    if(action==='stockLoss'){productField();field(form,'type','Reason',null,['Damage','Loss']);field(form,'quantity','Units affected','number');field(form,'note','Explanation','text')}
    if(!productOptions.length&&['restock','stockLoss'].includes(action)){d.append(node('p','inline-notice','No active items are available.'));return}
    const submit=button('Review action','btn btn-dark btn-full',()=>{if(!form.reportValidity())return;const data=Object.fromEntries(new FormData(form));for(const k of ['amount','unitCost','quantity'])if(k in data){const n=Number(data[k]);if(!Number.isFinite(n)||(k==='quantity'?!Number.isSafeInteger(n)||n<=0:n<=0)){banner('Enter a valid positive '+k);return}data[k]=n}if(action==='transfer'&&data.from===data.to){banner('Choose two different wallets');return}closeDialog();openConfirm(names[action],action==='stockLoss'?data.quantity+' units':money(data.amount||data.quantity*data.unitCost),'This will create a permanent shop record. Check the details before confirming.',()=>performWrite(action,data,names[action]+' completed'))},'arrow');submit.disabled=state.busy;form.append(submit);d.append(form)
  }
  async function performWrite(action,payload,success,onSuccess){if(state.busy||guardPending())return;const requestId=id();state.pending={requestId,action,payload,username:state.username,createdAt:Date.now()};savePending();await attemptPending(success,onSuccess)}
  async function attemptPending(success,onSuccess){
    if(state.busy||!state.pending||state.pendingBlocked||state.pending.username!==state.username){banner('Sign in with the original account to resolve this request.');return;}
    state.busy=true;const pending=state.pending;closeDialog();render();setOperation('Checking transaction · Keep this page open');
    try{
      const r=await api(pending.action,pending.payload,pending.requestId);
      if(r.state&&r.state!=='COMMITTED')throw Error('Transaction has not committed.');
      state.pending=null;savePending();state.busy=false;setOperation(null);
      if(onSuccess)onSuccess();
      // Confirmation is based solely on the server response; refreshing data is secondary.
      showSuccess(r.transactionId,r.duplicate);
      refresh({withHistory:true}).catch(()=>{});
    }catch(err){
      state.busy=false;setOperation(null);
      if(authError(err))return;
      banner(normalError(err));openPending();
    }finally{state.busy=false;setOperation(null)}
  }
  function showSuccess(transactionId,duplicate){const d=openDialog(duplicate?'Already recorded':'Successfully recorded');const icon=node('div','confirm-symbol');icon.append(svg('check'));d.append(icon,node('h2','',duplicate?'No duplicate was created.':'Transaction complete.'),node('p','muted',transactionId?'Reference: '+transactionId:'The server confirmed this action.'));const done=button('Done','btn btn-dark btn-full',closeDialog,'check');done.style.marginTop='23px';d.append(done)}
  function openPending(){if(!state.pending||state.pending.username!==state.username)return;const d=openDialog('Checking transaction');d.append(node('div','inline-notice warn','Outcome not yet confirmed. Keep the original request ID; never submit the same business event as a new sale.'),node('p','item-desc','Request ID: '+state.pending.requestId),node('p','muted','Retry sends exactly the same operation and request ID. The backend prevents a duplicate posting.'));const actions=node('div','dialog-actions');actions.append(button('Close','btn btn-quiet',closeDialog),button('Retry safely','btn btn-dark',()=>attemptPending('Transaction confirmed'),'refresh'));d.append(actions)}
  function account(){const d=openDialog('Your account');d.append(node('p','item-title','Signed in as '+state.username+' · '+state.role),node('p','item-desc','Session ends at '+new Date(state.expiry).toLocaleString('en-GH')));const out=button('Sign out','btn btn-dark btn-full',()=>{closeDialog();logout()},'log-out');out.style.marginTop='21px';d.append(out)}
  async function login(e){e.preventDefault();const err=$('loginError'),btn=$('loginButton');err.hidden=true;const username=$('username').value.trim(),pin=$('pin').value;if(!username||!/^[0-9]{6,12}$/.test(pin)){err.textContent='Enter a username and 6–12-digit PIN.';err.hidden=false;return}btn.disabled=true;btn.setAttribute('aria-busy','true');btn.replaceChildren(node('span','spinner'),document.createTextNode(' Signing in…'));setOperation('Signing in securely…');try{const data=await api('login',{username,pin},undefined,null);if(!data.token||!['owner','staff'].includes(data.role)||!Date.parse(data.expiresAt))throw Error('Unexpected authentication response');rememberSession(data,username);$('pin').value='';$('loginScreen').hidden=true;$('workspace').hidden=false;await refresh({withHistory:false});if(state.pending)openPending();else if(state.pendingBlocked)banner('Unresolved request belongs to another account. Ask the original account to sign in.')}catch(e){err.textContent=normalError(e);err.hidden=false}finally{setOperation(null);btn.disabled=false;btn.removeAttribute('aria-busy');btn.replaceChildren(document.createTextNode('Enter your workspace '),svg('arrow'))}}
  function wire(){
    $('loginForm').addEventListener('submit',login);
    $('togglePin').addEventListener('click',()=>{const pin=$('pin');const show=pin.type==='password';pin.type=show?'text':'password';$('togglePin').setAttribute('aria-pressed',String(show));$('togglePin').setAttribute('aria-label',show?'Hide PIN':'Show PIN')});
    document.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.nav)));
    $('accountButton').addEventListener('click',account);
    $('overlay').addEventListener('click',e=>{if(e.target===$('overlay'))closeDialog()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('overlay').hidden)closeDialog()});
    $('environmentLabel').textContent=(config.ENVIRONMENT||'TEST')+' ENVIRONMENT';$('envTag').textContent=config.ENVIRONMENT||'TEST';
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&sessionValid()&&!state.busy)refresh({withHistory:state.tab==='activity'})});
    setInterval(()=>{if(document.visibilityState==='visible'&&sessionValid()&&!state.busy&&!state.pending)refresh({withHistory:state.tab==='activity'})},45000);
    restoreSaved();if(sessionValid()){$('loginScreen').hidden=true;$('workspace').hidden=false;refresh();if(state.pending)setTimeout(openPending,400)}
  }
  wire();
  // Local contract-test hooks. No ability to post without the configured API.
  window.MONO_DIAGNOSTICS=Object.freeze({configured:apiConfigured(),environment:config.ENVIRONMENT||'TEST',brand:'GlepsyiCarePro',apiActions:['login','logout','ping','products','balances','history','sale','restock','expense','capital','transfer','stockLoss']});
})();
