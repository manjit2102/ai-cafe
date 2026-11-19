const express    = require("express");
const cors       = require("cors");
const bodyParser = require("body-parser");
const path       = require("path");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

/* ═══════════════════════════════════════
   DATA STORE
═══════════════════════════════════════ */
const users  = {};
const orders = [];
let   orderCounter = 1;

const GST_RATE = 0.05; // 5% GST on food/beverages

/* ═══════════════════════════════════════
   MENU  (20 items, 4 categories)
═══════════════════════════════════════ */
const menu = [
  // ── HOT DRINKS ──
  { id:1,  name:"Espresso",         nameHi:"एस्प्रेसो",        category:"Hot Drinks",  price:120, prepTime:3,  tags:["strong","coffee","classic"],          emoji:"☕", cal:10,  rating:4.8 },
  { id:2,  name:"Cappuccino",       nameHi:"कैपुचीनो",          category:"Hot Drinks",  price:160, prepTime:5,  tags:["coffee","milk","frothy","classic"],    emoji:"☕", cal:90,  rating:4.7 },
  { id:3,  name:"Latte",            nameHi:"लाटे",              category:"Hot Drinks",  price:170, prepTime:5,  tags:["coffee","milk","smooth","mild"],       emoji:"☕", cal:120, rating:4.6 },
  { id:4,  name:"Mocha",            nameHi:"मोका",              category:"Hot Drinks",  price:190, prepTime:6,  tags:["coffee","chocolate","sweet","rich"],   emoji:"☕", cal:200, rating:4.5 },
  { id:5,  name:"Masala Chai",      nameHi:"मसाला चाय",         category:"Hot Drinks",  price:90,  prepTime:4,  tags:["tea","spicy","milk","classic","chai"], emoji:"🍵", cal:80,  rating:4.9 },
  { id:6,  name:"Green Tea",        nameHi:"ग्रीन टी",          category:"Hot Drinks",  price:100, prepTime:3,  tags:["tea","healthy","light","vegan"],       emoji:"🍵", cal:5,   rating:4.4 },

  // ── COLD DRINKS ──
  { id:7,  name:"Cold Brew",        nameHi:"कोल्ड ब्रू",        category:"Cold Drinks", price:200, prepTime:2,  tags:["coffee","cold","strong","refreshing"], emoji:"🧊", cal:15,  rating:4.7 },
  { id:8,  name:"Iced Latte",       nameHi:"आइस्ड लाटे",        category:"Cold Drinks", price:190, prepTime:3,  tags:["coffee","cold","milk","smooth"],       emoji:"🧊", cal:110, rating:4.6 },
  { id:9,  name:"Mango Smoothie",   nameHi:"मैंगो स्मूदी",      category:"Cold Drinks", price:180, prepTime:4,  tags:["fruit","sweet","cold","vegan"],        emoji:"🥭", cal:160, rating:4.5 },
  { id:10, name:"Berry Blast",      nameHi:"बेरी ब्लास्ट",      category:"Cold Drinks", price:170, prepTime:4,  tags:["fruit","sweet","cold","healthy"],      emoji:"🫐", cal:140, rating:4.4 },
  { id:11, name:"Lemonade",         nameHi:"नींबू पानी",         category:"Cold Drinks", price:100, prepTime:2,  tags:["cold","light","refreshing","vegan"],   emoji:"🍋", cal:60,  rating:4.5 },

  // ── SNACKS ──
  { id:12, name:"Croissant",        nameHi:"क्रोइसां",          category:"Snacks",      price:120, prepTime:1,  tags:["pastry","buttery","classic","light"],  emoji:"🥐", cal:240, rating:4.6 },
  { id:13, name:"Brownie",          nameHi:"ब्राउनी",           category:"Snacks",      price:110, prepTime:1,  tags:["sweet","chocolate","dessert"],         emoji:"🍫", cal:310, rating:4.7 },
  { id:14, name:"Blueberry Muffin", nameHi:"ब्लूबेरी मफिन",     category:"Snacks",      price:100, prepTime:1,  tags:["sweet","pastry","light","classic"],    emoji:"🫐", cal:220, rating:4.4 },
  { id:15, name:"Avocado Toast",    nameHi:"एवोकैडो टोस्ट",    category:"Snacks",      price:220, prepTime:5,  tags:["healthy","vegan","savory","trendy"],   emoji:"🥑", cal:280, rating:4.5 },
  { id:16, name:"Samosa",           nameHi:"समोसा",             category:"Snacks",      price:60,  prepTime:2,  tags:["savory","spicy","classic","indian"],   emoji:"🥟", cal:180, rating:4.8 },

  // ── MEALS ──
  { id:17, name:"Club Sandwich",    nameHi:"क्लब सैंडविच",     category:"Meals",       price:280, prepTime:8,  tags:["savory","filling","classic"],          emoji:"🥪", cal:420, rating:4.5 },
  { id:18, name:"Caesar Salad",     nameHi:"सीज़र सलाद",        category:"Meals",       price:240, prepTime:6,  tags:["healthy","light","fresh"],             emoji:"🥗", cal:180, rating:4.3 },
  { id:19, name:"Pasta Primavera",  nameHi:"पास्ता प्रिमावेरा", category:"Meals",       price:320, prepTime:12, tags:["savory","vegan","filling","hearty"],   emoji:"🍝", cal:390, rating:4.6 },
  { id:20, name:"Veg Wrap",         nameHi:"वेज रैप",           category:"Meals",       price:200, prepTime:6,  tags:["healthy","vegan","light","fresh"],     emoji:"🌯", cal:310, rating:4.4 },
];

/* ═══════════════════════════════════════
   AI RECOMMENDATION ENGINE
═══════════════════════════════════════ */
function getTimeCtx() {
  const h = new Date().getHours();
  if (h >= 6  && h < 11) return { slot:"morning",   tags:["coffee","tea","light","pastry","healthy","classic"] };
  if (h >= 11 && h < 14) return { slot:"lunch",     tags:["filling","savory","meal","hearty","healthy"] };
  if (h >= 14 && h < 17) return { slot:"afternoon", tags:["cold","refreshing","sweet","snack","light"] };
  if (h >= 17 && h < 21) return { slot:"evening",   tags:["tea","snack","light","classic","indian"] };
  return                         { slot:"night",     tags:["light","mild","tea","classic"] };
}

const moodMap = {
  energetic:  ["strong","coffee","espresso","classic"],
  relaxed:    ["tea","light","herbal","mild","chai"],
  happy:      ["sweet","fruit","smoothie","dessert"],
  tired:      ["strong","coffee","espresso","classic"],
  healthy:    ["vegan","healthy","fresh","light"],
  indulgent:  ["rich","chocolate","sweet","dessert","mocha"],
};

function scoreItem(item, favTags=[], weather="normal", mood=null) {
  let score = 0;
  const ctx  = getTimeCtx();
  score += item.tags.filter(t => ctx.tags.includes(t)).length * 20;
  score += item.tags.filter(t => favTags.includes(t)).length * 30;
  if (weather === "hot"   && item.tags.includes("cold"))    score += 25;
  if (weather === "cold"  && item.tags.includes("classic")) score += 25;
  if (weather === "rainy" && (item.tags.includes("tea") || item.tags.includes("chai"))) score += 30;
  if (mood && moodMap[mood]) {
    score += item.tags.filter(t => moodMap[mood].includes(t)).length * 25;
  }
  score += (item.rating - 4) * 15;
  score += Math.max(0, 10 - item.prepTime) * 2;
  return score;
}

function getRecommendations(userId, weather="normal", mood=null, count=6) {
  const user    = users[userId] || { history:[] };
  const favTags = {};
  (user.history||[]).forEach(o => o.items.forEach(i => (i.tags||[]).forEach(t => { favTags[t]=(favTags[t]||0)+1; })));
  const topTags = Object.keys(favTags).sort((a,b)=>favTags[b]-favTags[a]).slice(0,5);
  return menu.map(item=>({...item,score:scoreItem(item,topTags,weather,mood)}))
             .sort((a,b)=>b.score-a.score).slice(0,count);
}

/* ═══════════════════════════════════════
   WAIT TIME
═══════════════════════════════════════ */
function calcWait(cartItems) {
  const active = orders.filter(o=>o.status==="pending"||o.status==="preparing").length;
  const maxPrep = Math.max(...cartItems.map(i=>i.prepTime||5));
  const wait    = maxPrep + active * 2;
  const express = menu.filter(m=>m.prepTime<=2).slice(0,3);
  return {
    estimatedWait: wait,
    queueLength:   active,
    expressItems:  express,
    tip: wait>15 ? "Busy kitchen! Try an express item for instant service."
       : wait>8  ? "Moderate wait — we'll keep you posted!"
       :           "Great timing! Kitchen is free. Super fast delivery!",
    tipHi: wait>15 ? "किचन व्यस्त है! एक्सप्रेस आइटम ट्राय करें।"
         : wait>8  ? "थोड़ा इंतजार — हम आपको अपडेट करते रहेंगे!"
         :           "बढ़िया समय! किचन खाली है। बहुत जल्दी मिलेगा!",
  };
}

/* ═══════════════════════════════════════
   BILLING
═══════════════════════════════════════ */
function calcBill(cartItems) {
  const lineItems = cartItems.map(i => ({
    id: i.id, name: i.name, nameHi: i.nameHi, emoji: i.emoji,
    qty: i.qty, unitPrice: i.price, lineTotal: i.price * i.qty,
  }));
  const subtotal = lineItems.reduce((s,i)=>s+i.lineTotal,0);
  const gst      = Math.round(subtotal * GST_RATE);
  const total    = subtotal + gst;
  return { lineItems, subtotal, gst, gstRate: GST_RATE*100, total };
}

/* ═══════════════════════════════════════
   ROUTES
═══════════════════════════════════════ */
// GET /api/menu
app.get("/api/menu", (req,res) => {
  res.json({ menu, categories:[...new Set(menu.map(i=>i.category))] });
});

// POST /api/register
app.post("/api/register", (req,res) => {
  const { userId, name } = req.body;
  if (!userId) return res.status(400).json({error:"userId required"});
  if (!users[userId]) users[userId] = { name:name||"Guest", history:[], mood:null, weather:"normal" };
  res.json({ success:true, user:users[userId] });
});

// GET /api/recommendations/:userId?weather=hot&mood=relaxed
app.get("/api/recommendations/:userId", (req,res) => {
  const { weather, mood } = req.query;
  const recs = getRecommendations(req.params.userId, weather||"normal", mood||null);
  res.json({ recommendations:recs, timeSlot:getTimeCtx().slot });
});

// POST /api/wait-estimate  { items:[{id,qty}] }
app.post("/api/wait-estimate", (req,res) => {
  const resolved = (req.body.items||[]).map(c=>{
    const m=menu.find(x=>x.id===c.id); return m?{...m,qty:c.qty}:null;
  }).filter(Boolean);
  if (!resolved.length) return res.status(400).json({error:"No valid items"});
  res.json(calcWait(resolved));
});

// POST /api/bill  { items:[{id,qty}] }
app.post("/api/bill", (req,res) => {
  const resolved = (req.body.items||[]).map(c=>{
    const m=menu.find(x=>x.id===c.id); return m?{...m,qty:c.qty}:null;
  }).filter(Boolean);
  if (!resolved.length) return res.status(400).json({error:"No valid items"});
  res.json(calcBill(resolved));
});

// POST /api/order  { userId, customerName, items:[{id,qty}] }
app.post("/api/order", (req,res) => {
  const { userId, customerName, items } = req.body;
  const resolved = (items||[]).map(c=>{
    const m=menu.find(x=>x.id===c.id); return m?{...m,qty:c.qty}:null;
  }).filter(Boolean);
  if (!resolved.length) return res.status(400).json({error:"Empty order"});

  const bill    = calcBill(resolved);
  const wait    = calcWait(resolved);
  const orderId = `NGC${String(orderCounter++).padStart(4,"0")}`;
  const order   = {
    id:orderId, userId, customerName:customerName||"Guest",
    items:resolved, bill, estimatedWait:wait.estimatedWait,
    status:"pending", placedAt:new Date(), updatedAt:new Date(),
  };
  orders.push(order);
  if (userId && users[userId]) users[userId].history.push({ orderId, items:resolved, placedAt:new Date() });

  setTimeout(()=>advanceStatus(orderId,"preparing"), 5000);
  setTimeout(()=>advanceStatus(orderId,"ready"), wait.estimatedWait*60*1000);

  res.json({ success:true, order, waitInfo:wait,
    message:`Order ${orderId} placed! Ready in ~${wait.estimatedWait} min.`,
    messageHi:`ऑर्डर ${orderId} हो गया! ~${wait.estimatedWait} मिनट में तैयार होगा।` });
});

// GET /api/order/:id
app.get("/api/order/:id", (req,res) => {
  const o = orders.find(x=>x.id===req.params.id);
  if (!o) return res.status(404).json({error:"Order not found"});
  const elapsed   = Math.floor((Date.now()-new Date(o.placedAt))/60000);
  const remaining = Math.max(0, o.estimatedWait - elapsed);
  res.json({...o, elapsed, remaining});
});

// GET /api/queue
app.get("/api/queue", (req,res) => {
  const active = orders.filter(o=>o.status!=="ready"&&o.status!=="cancelled");
  res.json({ queue:active, count:active.length });
});

// POST /api/mood  { userId, mood }
app.post("/api/mood", (req,res) => {
  const { userId, mood } = req.body;
  const tags = moodMap[mood]||[];
  const suggestions = menu.map(i=>({...i,score:i.tags.filter(t=>tags.includes(t)).length}))
                          .filter(i=>i.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
  res.json({ mood, suggestions });
});

// Search menu items by name (for voice NLP)
app.get("/api/search", (req,res) => {
  const q = (req.query.q||"").toLowerCase();
  if (!q) return res.json({ results:[] });
  const results = menu.filter(i =>
    i.name.toLowerCase().includes(q) ||
    (i.nameHi && i.nameHi.includes(q)) ||
    i.tags.some(t=>t.includes(q)) ||
    i.category.toLowerCase().includes(q)
  );
  res.json({ results });
});

function advanceStatus(id, status) {
  const o = orders.find(x=>x.id===id);
  if (o && o.status!=="ready") { o.status=status; o.updatedAt=new Date(); }
}

// Serve SPA
app.use((req,res) => {
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.listen(PORT, () => console.log(`\n🎙️  NextGenCafe live → http://localhost:${PORT}\n`));
