/* ══════════════════════════════════════
   NextGenCafe — script.js
   AI + Bilingual Voice Ordering System
   ══════════════════════════════════════ */

const API = window.location.origin + "/api";

/* ─── STATE ─── */
const S = {
  userId: null, userName: "Guest",
  lang: "en",        // "en" | "hi" | "hinglish"
  voiceLang: "en-IN",
  weather: "normal",
  cart: [],
  menu: [], cats: [],
  currentPage: "home",
  lastOrderId: null,
  recognition: null,
  synth: window.speechSynthesis,
  listening: false,
};

/* ─── UTILS ─── */
const uid = () => "u_" + Math.random().toString(36).slice(2,10);
const fmt = n  => "₹" + n;
const $   = id => document.getElementById(id);
const $$  = sel=> document.querySelectorAll(sel);

function toast(msg, type="ok") {
  const wrap = $("toastWrap");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  const icon = type==="ok"?"✅":type==="warn"?"⚠️":"❌";
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function showPage(name) {
  $$(".page").forEach(p=>p.classList.remove("active"));
  $(`page-${name}`).classList.add("active");
  $$(".tab").forEach(t=>t.classList.toggle("active",t.dataset.page===name));
  S.currentPage = name;
  if (name==="track") loadQueue();
}

/* ─── LOADER ─── */
window.addEventListener("load", () => {
  setTimeout(() => {
    $("loader").classList.add("gone");
    const saved = localStorage.getItem("ngc_user");
    if (saved) {
      const u = JSON.parse(saved);
      Object.assign(S, { userId:u.userId, userName:u.name, lang:u.lang||"en", weather:u.weather||"normal" });
      applyUser();
    } else {
      $("onboardOverlay").classList.remove("hidden");
    }
  }, 2200);
});

/* ─── ONBOARD ─── */
// Chip selectors
function chipGroup(selector, key) {
  $$(selector).forEach(btn => {
    btn.addEventListener("click", () => {
      $$(selector).forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      S[key] = btn.dataset[key==="lang"?"lang":key==="weather"?"w":key];
    });
  });
}
chipGroup("#langChips .chip",    "lang");
chipGroup("#weatherChips .chip", "weather");

$("obStart").addEventListener("click", async () => {
  S.userName = $("obName").value.trim() || "Guest";
  S.userId   = uid();
  try {
    await fetch(`${API}/register`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ userId:S.userId, name:S.userName }),
    });
  } catch(e){}
  localStorage.setItem("ngc_user", JSON.stringify({ userId:S.userId, name:S.userName, lang:S.lang, weather:S.weather }));
  $("onboardOverlay").classList.add("hidden");
  applyUser();
});

/* ─── APPLY USER ─── */
async function applyUser() {
  $("hdrName").textContent = S.userName;
  updateLangBadge();
  await loadMenu();
  await loadRecs();
  initVoice();
}

/* ─── LANGUAGE ─── */
const langBadgeMap = { en:"🇬🇧 EN", hi:"🇮🇳 HI", hinglish:"🔀 MIX" };
const voiceLangMap = { en:"en-IN", hi:"hi-IN", hinglish:"hi-IN" };

function updateLangBadge() {
  $("langBadge").textContent  = langBadgeMap[S.lang] || "🇬🇧 EN";
  S.voiceLang = voiceLangMap[S.lang] || "en-IN";
  $$(".lang-tog").forEach(b=>b.classList.toggle("active",b.dataset.lang===S.lang));
}

$$(".lang-tog").forEach(btn => {
  btn.addEventListener("click", () => {
    S.lang = btn.dataset.lang;
    updateLangBadge();
    if (S.recognition) {
      S.recognition.lang = S.voiceLang;
    }
    speak(S.lang==="hi" ? "भाषा बदल गई। हिंदी में बोलिए।" : "Language switched to English. Go ahead!");
  });
});

/* ─── MENU ─── */
async function loadMenu() {
  try {
    const r = await fetch(`${API}/menu`);
    const d = await r.json();
    S.menu = d.menu; S.cats = ["All",...d.categories];
    renderCatFilters();
    renderMenu(S.menu);
  } catch(e){ toast("Menu load failed","err"); }
}

function renderCatFilters() {
  const wrap = $("catFilters");
  wrap.innerHTML = S.cats.map((c,i)=>
    `<button class="filt-btn${i===0?" active":""}" data-cat="${c}">${c}</button>`
  ).join("");
  $$(".filt-btn").forEach(btn=>btn.addEventListener("click",()=>{
    $$(".filt-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    filterMenu(btn.dataset.cat, $("menuSearch").value.toLowerCase());
  }));
}

function filterMenu(cat="All", term="") {
  let items = S.menu;
  if (cat!=="All") items=items.filter(i=>i.category===cat);
  if (term)        items=items.filter(i=>i.name.toLowerCase().includes(term)||i.tags.some(t=>t.includes(term)));
  renderMenu(items);
}

function renderMenu(items) {
  const grid = $("menuGrid");
  if (!items.length){ grid.innerHTML=`<p style="color:var(--muted);padding:2rem">No items found.</p>`; return; }
  grid.innerHTML = items.map(i=>cardHTML(i,false)).join("");
  hookAddBtns(grid);
}

function cardHTML(item, isAI=false) {
  const stars = "★".repeat(Math.round(item.rating))+"☆".repeat(5-Math.round(item.rating));
  return `
  <div class="menu-card">
    ${isAI?`<div class="ai-tag">AI Pick</div>`:""}
    <div class="card-emoji">${item.emoji}</div>
    <div class="card-name">${item.name}</div>
    <div class="card-name-hi">${item.nameHi||""}</div>
    <div class="card-cat">${item.category}</div>
    <div class="card-stars">${stars} ${item.rating}</div>
    <div class="card-tags">${item.tags.slice(0,3).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    <div class="card-foot">
      <div>
        <div class="card-price">${fmt(item.price)}</div>
        <div class="card-prep">⏱ ${item.prepTime} min</div>
      </div>
      <button class="add-btn" data-id="${item.id}">+</button>
    </div>
  </div>`;
}

function hookAddBtns(parent) {
  parent.querySelectorAll(".add-btn").forEach(btn=>{
    btn.addEventListener("click",()=>addToCart(Number(btn.dataset.id)));
  });
}

$("menuSearch").addEventListener("input",e=>{
  const cat = document.querySelector(".filt-btn.active")?.dataset.cat||"All";
  filterMenu(cat,e.target.value.toLowerCase());
});

/* ─── RECOMMENDATIONS ─── */
async function loadRecs() {
  try {
    const r = await fetch(`${API}/recommendations/${S.userId}?weather=${S.weather}`);
    const d = await r.json();
    const grid = $("recsGrid");
    grid.innerHTML = d.recommendations.map(i=>cardHTML(i,true)).join("");
    hookAddBtns(grid);
  } catch(e){}
}
$("refreshRecs").addEventListener("click", loadRecs);

/* ─── CART ─── */
function addToCart(id, qty=1) {
  const item = S.menu.find(m=>m.id===id);
  if (!item) return;
  const ex = S.cart.find(c=>c.id===id);
  if (ex) ex.qty+=qty; else S.cart.push({...item,qty});
  renderCart();
  toast(`${item.emoji} ${item.name} added!`,"ok");
  estimateWait();
  return item;
}

function removeFromCart(id) {
  const idx = S.cart.findIndex(c=>c.id===id);
  if (idx===-1) return;
  if (S.cart[idx].qty>1) S.cart[idx].qty--; else S.cart.splice(idx,1);
  renderCart(); estimateWait();
}

function renderCart() {
  const count = S.cart.reduce((s,i)=>s+i.qty,0);
  $("cartCount").textContent = count;
  const body   = $("cartBody");
  const footer = $("cartFooter");

  if (!S.cart.length) {
    body.innerHTML=`<div class="empty-cart"><div>🧺</div><p>Cart is empty</p><button class="btn-ghost-sm" id="goMenuBtn2">Browse Menu</button></div>`;
    footer.classList.add("hidden");
    $("goMenuBtn2")?.addEventListener("click",()=>{closeCart();showPage("menu");});
    return;
  }

  body.innerHTML = S.cart.map(item=>`
    <div class="cart-item">
      <div class="ci-emoji">${item.emoji}</div>
      <div class="ci-info">
        <div class="ci-name">${item.name}</div>
        <div class="ci-price">${fmt(item.price)} × ${item.qty} = ${fmt(item.price*item.qty)}</div>
      </div>
      <div class="qty-ctrl">
        <button class="qty-btn" data-action="dec" data-id="${item.id}">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" data-action="inc" data-id="${item.id}">+</button>
      </div>
    </div>`).join("");

  $$(".qty-btn").forEach(btn=>btn.addEventListener("click",()=>{
    const id=Number(btn.dataset.id);
    btn.dataset.action==="inc"?addToCart(id):removeFromCart(id);
  }));

  footer.classList.remove("hidden");
  renderBillPreview();
}

function renderBillPreview() {
  const sub = S.cart.reduce((s,i)=>s+i.price*i.qty,0);
  const gst = Math.round(sub*0.05);
  const tot = sub+gst;
  $("billPreview").innerHTML=`
    <div class="bp-row"><span>Subtotal</span><span>${fmt(sub)}</span></div>
    <div class="bp-row"><span>GST (5%)</span><span>${fmt(gst)}</span></div>
    <div class="bp-total"><span>Total</span><span>${fmt(tot)}</span></div>`;
}

async function estimateWait() {
  if (!S.cart.length) return;
  try {
    const r = await fetch(`${API}/wait-estimate`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({items:S.cart.map(i=>({id:i.id,qty:i.qty}))}),
    });
    const d = await r.json();
    $("cwTime").textContent = `${d.estimatedWait} min`;
    $("cwTip").textContent  = S.lang==="hi"?d.tipHi:d.tip;
    const wb = $("waitBar");
    wb.classList.remove("hidden");
    $("waitBarText").textContent=`Est. wait: ${d.estimatedWait} min · ${d.queueLength} order(s) ahead`;
    $("waitBarTip").textContent =S.lang==="hi"?d.tipHi:d.tip;
  } catch(e){}
}

// Cart open/close
$("cartToggle").addEventListener("click",openCart);
$("cartClose").addEventListener("click",closeCart);
$("drawerOverlay").addEventListener("click",closeCart);
$("goMenuBtn")?.addEventListener("click",()=>{closeCart();showPage("menu");});
function openCart()  { $("cartDrawer").classList.add("open");$("drawerOverlay").classList.add("open"); }
function closeCart() { $("cartDrawer").classList.remove("open");$("drawerOverlay").classList.remove("open"); }

/* ─── BILL MODAL ─── */
$("showBillBtn").addEventListener("click",showBill);
async function showBill() {
  if (!S.cart.length){ toast("Cart is empty","warn"); return; }
  try {
    const r=await fetch(`${API}/bill`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({items:S.cart.map(i=>({id:i.id,qty:i.qty}))}),
    });
    const d=await r.json();
    $("billDate").textContent=new Date().toLocaleString("en-IN");
    $("billItems").innerHTML=d.lineItems.map(i=>`
      <div class="bill-row">
        <span class="bi-name">${i.emoji} ${i.name}</span>
        <span class="bi-qty">×${i.qty}</span>
        <span class="bi-amt">${fmt(i.lineTotal)}</span>
      </div>`).join("");
    $("billTotals").innerHTML=`
      <div class="bt-row"><span>Subtotal</span><span>${fmt(d.subtotal)}</span></div>
      <div class="bt-row"><span>GST (${d.gstRate}%)</span><span>${fmt(d.gst)}</span></div>
      <div class="bt-total"><span>Total</span><span>${fmt(d.total)}</span></div>`;
    $("billOverlay").classList.remove("hidden");
    speak(S.lang==="hi"
      ?`Aapka total ${fmt(d.total)} hai, jisme 5 percent GST shamil hai.`
      :`Your total is ${fmt(d.total)} including 5% GST.`);
  } catch(e){ toast("Could not load bill","err"); }
}

/* ─── PLACE ORDER ─── */
$("placeOrderBtn").addEventListener("click",placeOrder);
async function placeOrder() {
  if (!S.cart.length){ toast("Cart is empty!","warn"); return; }
  const btn=$("placeOrderBtn"); btn.disabled=true; btn.textContent="Placing…";
  try {
    const r=await fetch(`${API}/order`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ userId:S.userId, customerName:S.userName, items:S.cart.map(i=>({id:i.id,qty:i.qty})) }),
    });
    const d=await r.json();
    S.lastOrderId=d.order.id;
    closeCart();
    $("successMsg").textContent=S.lang==="hi"?d.messageHi:d.message;
    $("successBox").innerHTML=`
      <p>🆔 ${d.order.id}</p>
      <p>⏱ Wait: ~${d.waitInfo.estimatedWait} min</p>
      <p>💰 Total: ${fmt(d.order.bill.total)}</p>
      <p>${S.lang==="hi"?d.waitInfo.tipHi:d.waitInfo.tip}</p>`;
    $("successOverlay").classList.remove("hidden");
    speak(S.lang==="hi"
      ?`${d.messageHi}. Order ID hai ${d.order.id}.`
      :`${d.message}. Your order ID is ${d.order.id}.`);
    S.cart=[]; renderCart();
    loadRecs();
  } catch(e){ toast("Order failed!","err"); }
  finally{ btn.disabled=false; btn.textContent="✅ Place Order"; }
}

$("successTrack").addEventListener("click",()=>{
  $("successOverlay").classList.add("hidden");
  $("trackId").value=S.lastOrderId||"";
  showPage("track");
  if (S.lastOrderId) trackOrder(S.lastOrderId);
});
$("successClose").addEventListener("click",()=>$("successOverlay").classList.add("hidden"));

/* ─── TRACK ORDER ─── */
$("trackBtn").addEventListener("click",()=>{
  const id=$("trackId").value.trim().toUpperCase();
  if (!id){ toast("Enter an order ID","warn"); return; }
  trackOrder(id);
});
$("refreshTrack").addEventListener("click",()=>{
  const id=$("tOid").textContent;
  if(id) trackOrder(id);
});

async function trackOrder(id) {
  try {
    const r=await fetch(`${API}/order/${id}`);
    if(!r.ok){ toast("Order not found","err"); return; }
    const o=await r.json();
    $("trackResult").classList.remove("hidden");
    $("tOid").textContent=o.id;
    $("tName").textContent=o.customerName;
    $("tWait").textContent=`${o.estimatedWait} min`;
    $("tLeft").textContent=o.remaining>0?`${o.remaining} min`:"Ready!";

    const sp=$("tStatus");
    sp.textContent=o.status.charAt(0).toUpperCase()+o.status.slice(1);
    sp.className=`status-pill ${o.status}`;

    // Steps
    const statusOrder=["pending","preparing","ready"];
    const idx=statusOrder.indexOf(o.status);
    statusOrder.forEach((s,i)=>{
      const el=$(`s-${s}`);
      el.classList.remove("done","active");
      if(i<idx) el.classList.add("done");
      else if(i===idx) el.classList.add("active");
    });

    // Ring
    const r2=50, circ=2*Math.PI*r2;
    const pct=o.estimatedWait>0?Math.min(1,o.elapsed/o.estimatedWait):1;
    const fg=$("ringFg");
    fg.style.strokeDasharray=circ;
    fg.style.strokeDashoffset=circ*(1-pct);
    $("ringTxt").textContent=o.status==="ready"?"🎉 Ready!":o.remaining+" min left";

    // Bill summary in track
    if (o.bill) {
      $("trackBill").innerHTML=`
        <div class="meta-row"><span>Items</span><strong>${o.items.map(i=>`${i.emoji}×${i.qty}`).join(" ")}</strong></div>
        <div class="meta-row"><span>Total (incl. GST)</span><strong>${fmt(o.bill.total)}</strong></div>`;
    }

    // Voice update
    speak(o.status==="ready"
      ?(S.lang==="hi"?`Order ${o.id} ready hai! Please collect karein.`:`Order ${o.id} is ready! Please collect your order.`)
      :(S.lang==="hi"?`Order ${o.id} abhi ${o.status} hai. Lagbhag ${o.remaining} minute baaki hai.`
                     :`Order ${o.id} is currently ${o.status}. About ${o.remaining} minutes remaining.`));
  } catch(e){ toast("Could not track order","err"); }
}

async function loadQueue() {
  try {
    const r=await fetch(`${API}/queue`);
    const d=await r.json();
    const list=$("queueList");
    if (!d.queue.length){ list.innerHTML=`<p class="empty-q">No active orders right now. ☕</p>`; return; }
    list.innerHTML=d.queue.map(o=>`
      <div class="q-item">
        <div><div class="q-name">${o.id}</div><div class="q-sub">${o.customerName} · ${o.items.length} item(s)</div></div>
        <div><span class="status-pill ${o.status}">${o.status}</span><div style="font-size:.72rem;color:var(--muted);text-align:right;margin-top:.2rem">~${o.estimatedWait} min</div></div>
      </div>`).join("");
  } catch(e){}
}

/* ─── MODAL CLOSE ─── */
$$(".modal-close").forEach(btn=>{
  btn.addEventListener("click",()=>$(`${btn.dataset.target}`).classList.add("hidden"));
});

/* ─── NAV ─── */
$$(".tab").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.page)));

/* ─── AUTO REFRESH ─── */
setInterval(()=>{ if(S.currentPage==="track") loadQueue(); },15000);

/* ════════════════════════════════════════════
   VOICE ENGINE
   ════════════════════════════════════════════ */
function initVoice() {
  const SpeechRecognition = window.SpeechRecognition||window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $("micBtn").title="Voice not supported in this browser. Use Chrome/Edge.";
    toast("Voice requires Chrome or Edge","warn");
    return;
  }

  const rec = new SpeechRecognition();
  rec.continuous    = false;
  rec.interimResults= true;
  rec.lang          = S.voiceLang;
  S.recognition     = rec;

  rec.onstart = ()=>{
    S.listening=true;
    $("micBtn").classList.add("listening");
    $("micRings").classList.add("active");
    $("voiceTranscript").innerHTML=`<span style="color:var(--accent)">🎙️ Listening…</span>`;
  };

  rec.onend = ()=>{
    S.listening=false;
    $("micBtn").classList.remove("listening");
    $("micRings").classList.remove("active");
  };

  rec.onerror = e=>{
    $("micBtn").classList.remove("listening");
    $("micRings").classList.remove("active");
    if (e.error==="not-allowed") speak("Please allow microphone access.");
  };

  rec.onresult = e=>{
    const results = Array.from(e.results);
    const transcript = results.map(r=>r[0].transcript).join("");
    $("voiceTranscript").textContent = `🎙️ "${transcript}"`;
    if (e.results[e.results.length-1].isFinal) {
      processCommand(transcript.toLowerCase().trim());
    }
  };

  $("micBtn").addEventListener("click",()=>{
    if (S.listening) { rec.stop(); return; }
    rec.lang = S.voiceLang;
    try { rec.start(); } catch(e){}
  });
}

/* ─── TEXT-TO-SPEECH ─── */
function speak(text) {
  if (!S.synth) return;
  S.synth.cancel();
  const utt  = new SpeechSynthesisUtterance(text);
  utt.lang   = S.voiceLang;
  utt.rate   = 1.05;
  utt.pitch  = 1.1;
  $("waiterBubble").textContent = text;
  S.synth.speak(utt);
}

/* ─── NLP COMMAND PROCESSOR ─── */
async function processCommand(cmd) {
  console.log("Voice cmd:", cmd);

  // ── LANGUAGE SWITCH ──
  if (matchAny(cmd,["hindi mein","hindi me","switch to hindi","हिंदी में"])) {
    S.lang="hi"; S.voiceLang="hi-IN"; updateLangBadge();
    if(S.recognition) S.recognition.lang="hi-IN";
    return speak("अब मैं हिंदी में बात करूंगा। बोलिए!");
  }
  if (matchAny(cmd,["english mein","switch to english","english me baat"])) {
    S.lang="en"; S.voiceLang="en-IN"; updateLangBadge();
    if(S.recognition) S.recognition.lang="en-IN";
    return speak("Switched to English. How can I help you?");
  }

  // ── GREET ──
  if (matchAny(cmd,["hello","hi","namaste","नमस्ते","hey"])) {
    return speak(S.lang==="hi"
      ?`Namaste ${S.userName}! Aaj kya lenge?`
      :`Hello ${S.userName}! What can I get for you today?`);
  }

  // ── SHOW MENU / CATEGORIES ──
  if (matchAny(cmd,["show menu","menu dikhao","menu dikhaiye","menu kya hai","what's on the menu","menu"])) {
    showPage("menu");
    return speak(S.lang==="hi"?"Menu khul gaya! Kya lena chahenge?":"Here's our menu! What would you like?");
  }

  // ── SHOW CART ──
  if (matchAny(cmd,["cart mein kya","cart kya hai","what's in my cart","show cart","mera cart","my cart"])) {
    openCart();
    if (!S.cart.length) return speak(S.lang==="hi"?"Aapka cart khali hai.":"Your cart is empty.");
    const items = S.cart.map(i=>`${i.name} ×${i.qty}`).join(", ");
    return speak(S.lang==="hi"?`Cart mein hai: ${items}`:`In your cart: ${items}`);
  }

  // ── CLEAR CART ──
  if (matchAny(cmd,["clear cart","cart clear","cart khali","remove everything","sab hatao"])) {
    S.cart=[]; renderCart();
    return speak(S.lang==="hi"?"Cart saaf ho gayi.":"Cart cleared.");
  }

  // ── BILL ──
  if (matchAny(cmd,["bill","bill batao","bill dikhao","show bill","mera bill","total kitna","how much","kitna hua","total kya hai"])) {
    await showBill();
    return;
  }

  // ── PLACE ORDER ──
  if (matchAny(cmd,["place order","order karo","order lagao","order place","confirm order","order de do","book karo","finalize"])) {
    if (!S.cart.length) return speak(S.lang==="hi"?"Cart khali hai, pehle kuch add karein.":"Your cart is empty. Please add items first.");
    await placeOrder();
    return;
  }

  // ── TRACK ORDER ──
  if (matchAny(cmd,["track order","order ka status","order status","order kahan hai","where is my order"])) {
    showPage("track");
    if (S.lastOrderId) {
      $("trackId").value=S.lastOrderId;
      await trackOrder(S.lastOrderId);
    } else {
      speak(S.lang==="hi"?"Order ID bataiye track karne ke liye.":"Please say your Order ID to track.");
    }
    return;
  }

  // ── WAIT TIME ──
  if (matchAny(cmd,["kitna time","wait time","how long","der lagegi","time lagega","ready kab","estimated time"])) {
    if (!S.cart.length) return speak(S.lang==="hi"?"Pehle kuch order karein.":"Please add items to your cart first.");
    try {
      const r=await fetch(`${API}/wait-estimate`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({items:S.cart.map(i=>({id:i.id,qty:i.qty}))}),
      });
      const d=await r.json();
      return speak(S.lang==="hi"
        ?`Aapka order lagbhag ${d.estimatedWait} minute mein ready hoga. ${d.tipHi}`
        :`Your order will be ready in about ${d.estimatedWait} minutes. ${d.tip}`);
    } catch(e){}
  }

  // ── RECOMMENDATIONS ──
  if (matchAny(cmd,["recommend","suggest","kya achha hai","kuch suggest","what's good","best item","popular","special","suggest karein","sujhao"])) {
    try {
      const r=await fetch(`${API}/recommendations/${S.userId}?weather=${S.weather}`);
      const d=await r.json();
      const top3 = d.recommendations.slice(0,3).map(i=>i.name).join(", ");
      return speak(S.lang==="hi"
        ?`Aaj ke liye meri recommendation hai: ${top3}. Kaunsa lenge?`
        :`I recommend: ${top3}. Which one would you like?`);
    } catch(e){}
  }

  // ── MOOD BASED ──
  if (matchAny(cmd,["thaka hua","tired","thaka","I'm tired"])) return suggestByMood("tired");
  if (matchAny(cmd,["energetic","energy chahiye","boost","josh"])) return suggestByMood("energetic");
  if (matchAny(cmd,["kuch meetha","sweet","dessert","meetha"])) return suggestByMood("indulgent");
  if (matchAny(cmd,["healthy","sehat","diet","light kuch"])) return suggestByMood("healthy");
  if (matchAny(cmd,["relax","shanti","calm","chill","aaram"])) return suggestByMood("relaxed");

  // ── QUANTITY PATTERNS ──
  // "do cappuccino do" / "2 latte chahiye" / "ek mocha" / "give me 3 samosas"
  const qtyResult = await tryQtyMatch(cmd);
  if (qtyResult) return;

  // ── ITEM NAME MATCH (direct) ──
  const item = await findItemInCmd(cmd);
  if (item) {
    addToCart(item.id);
    openCart();
    return speak(S.lang==="hi"
      ?`${item.nameHi||item.name} cart mein add ho gaya. Aur kuch?`
      :`${item.name} added to your cart. Anything else?`);
  }

  // ── FALLBACK ──
  speak(S.lang==="hi"
    ?`Mujhe samajh nahi aaya. Please dobara bolein ya menu dekhen.`
    :`I didn't catch that. Try saying item names like "Cappuccino" or "Masala Chai", or say "Recommend".`);
}

/* ─── HELPERS ─── */
function matchAny(cmd, patterns) {
  return patterns.some(p=>cmd.includes(p));
}

async function findItemInCmd(cmd) {
  // Try local match first
  const local = S.menu.find(m=>
    cmd.includes(m.name.toLowerCase()) ||
    (m.nameHi && cmd.includes(m.nameHi))
  );
  if (local) return local;
  // Fallback to API search
  try {
    const r=await fetch(`${API}/search?q=${encodeURIComponent(cmd)}`);
    const d=await r.json();
    if (d.results.length) return d.results[0];
  } catch(e){}
  return null;
}

async function tryQtyMatch(cmd) {
  const numWords = { "ek":1,"do":2,"teen":3,"char":4,"paanch":5,"one":1,"two":2,"three":3,"four":4,"five":5,"a":1,"an":1 };
  const tokens   = cmd.split(/\s+/);
  let   qty      = 1;
  let   found    = false;

  for (let i=0;i<tokens.length;i++) {
    const t = tokens[i];
    if (numWords[t]) { qty=numWords[t]; continue; }
    // number digit
    if (/^\d+$/.test(t)) { qty=parseInt(t); continue; }
    // Try matching rest of phrase as item
    const phrase = tokens.slice(i).join(" ");
    const item   = await findItemInCmd(phrase);
    if (item) {
      addToCart(item.id, qty);
      openCart();
      speak(S.lang==="hi"
        ?`${qty} ${item.nameHi||item.name} cart mein add ho gaya. Aur kuch?`
        :`Added ${qty} ${item.name} to your cart. Anything else?`);
      found=true; break;
    }
  }
  return found;
}

async function suggestByMood(mood) {
  try {
    const r=await fetch(`${API}/mood`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({userId:S.userId,mood}),
    });
    const d=await r.json();
    if (!d.suggestions.length) return speak("Let me check our menu for you.");
    const names=d.suggestions.slice(0,3).map(i=>i.name).join(", ");
    speak(S.lang==="hi"
      ?`Aapke mood ke liye suggest karta hoon: ${names}. Kaunsa lenge?`
      :`Based on your mood, I suggest: ${names}. Which one?`);
  } catch(e){}
}

/* ─── QUICK CMD CHIPS ─── */
$$(".cmd-chip").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const cmd=btn.dataset.cmd;
    $("voiceTranscript").textContent=`🎙️ "${cmd}"`;
    processCommand(cmd.toLowerCase());
  });
});

/* ─── INITIAL GREETING (after load) ─── */
setTimeout(()=>{
  const hour=new Date().getHours();
  const greeting = hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  if (S.userName && S.userName!=="Guest") {
    speak(S.lang==="hi"
      ?`Namaste ${S.userName}! NextGenCafe mein aapka swagat hai. Mic tap karke order karein ya kuch poochein.`
      :`Welcome to NextGenCafe, ${S.userName}! Tap the mic to order in Hindi or English.`);
  }
}, 3500);
