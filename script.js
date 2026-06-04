// ===== AUTH =====
const API_BASE = '/api';
let currentUser = null;
let pendingVerifyEmail = null;

function showScreen(name) {
  document.getElementById('authScreen').classList.toggle('hidden', name !== 'auth');
  document.getElementById('verifyScreen').classList.toggle('hidden', name !== 'verify');
  document.getElementById('landingScreen').classList.toggle('hidden', name !== 'landing');
  document.getElementById('bannedScreen').classList.toggle('hidden', name !== 'banned');
  document.getElementById('gameApp').classList.toggle('hidden', name !== 'game');
  if (name === 'landing') fetchLeaderboard();
}

function switchAuthTab(tab) {
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('authError').textContent = '';
}

async function apiPost(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  const t = token || localStorage.getItem('diddyrng_token');
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

async function apiGet(path) {
  const t = localStorage.getItem('diddyrng_token');
  const headers = {};
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

async function apiAdminGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'X-Admin-Passcode': 'Admin2167' } });
  return { ok: res.ok, data: await res.json() };
}

async function apiAdminPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Passcode': 'Admin2167' },
    body: JSON.stringify(body)
  });
  return { ok: res.ok, data: await res.json() };
}

async function checkAuth() {
  const token = localStorage.getItem('diddyrng_token');
  if (!token) { showScreen('auth'); return; }
  try {
    const { ok, data } = await apiGet('/auth/me');
    if (!ok) {
      if (data.banned) {
        document.getElementById('banReason').textContent = data.reason || data.error || 'No reason provided.';
        showScreen('banned');
      } else {
        localStorage.removeItem('diddyrng_token');
        showScreen('auth');
      }
      return;
    }
    currentUser = data.user;
    document.getElementById('landingUser').textContent = `Signed in as ${currentUser.email}`;
    document.getElementById('headerUser').textContent = currentUser.email;
    showScreen('landing');
  } catch {
    localStorage.removeItem('diddyrng_token');
    showScreen('auth');
  }
}

async function doRegister() {
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;
  const errEl = document.getElementById('authError');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  if (password !== confirm) { errEl.textContent = 'Passwords do not match.'; return; }
  const btn = document.getElementById('registerBtn');
  btn.disabled = true; btn.textContent = 'Creating Account…';
  try {
    const { ok, data } = await apiPost('/auth/register', { email, password });
    if (!ok) { errEl.textContent = data.error || 'Registration failed.'; return; }
    pendingVerifyEmail = email;
    document.getElementById('verifyHint').textContent = `Enter the 6-digit code for ${email}.`;
    const devBox = document.getElementById('devCodeBox');
    devBox.textContent = `🔑 Your code: ${data.code}`;
    showScreen('verify');
  } catch { errEl.textContent = 'Network error. Try again.'; }
  finally { btn.disabled = false; btn.textContent = 'Create Account'; }
}

async function doVerify() {
  const code = document.getElementById('verifyCode').value.trim();
  const errEl = document.getElementById('verifyError');
  errEl.textContent = '';
  if (!code || code.length !== 6) { errEl.textContent = 'Enter the 6-digit code.'; return; }
  try {
    const { ok, data } = await apiPost('/auth/verify', { email: pendingVerifyEmail, code });
    if (!ok) { errEl.textContent = data.error || 'Verification failed.'; return; }
    localStorage.setItem('diddyrng_token', data.token);
    currentUser = data.user;
    document.getElementById('landingUser').textContent = `Signed in as ${currentUser.email}`;
    document.getElementById('headerUser').textContent = currentUser.email;
    showScreen('landing');
  } catch { errEl.textContent = 'Network error. Try again.'; }
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('authError');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Signing In…';
  try {
    const { ok, status, data } = await apiPost('/auth/login', { email, password });
    if (!ok) {
      if (data.needsVerification) {
        pendingVerifyEmail = data.email || email;
        document.getElementById('verifyHint').textContent = `Enter the 6-digit code for ${pendingVerifyEmail}.`;
        document.getElementById('devCodeBox').textContent = '';
        showScreen('verify');
        return;
      }
      if (data.banned) {
        document.getElementById('banReason').textContent = data.error || 'No reason provided.';
        showScreen('banned');
        return;
      }
      errEl.textContent = data.error || 'Login failed.';
      return;
    }
    localStorage.setItem('diddyrng_token', data.token);
    currentUser = data.user;
    document.getElementById('landingUser').textContent = `Signed in as ${currentUser.email}`;
    document.getElementById('headerUser').textContent = currentUser.email;
    showScreen('landing');
  } catch { errEl.textContent = 'Network error. Try again.'; }
  finally { btn.disabled = false; btn.textContent = 'Sign In'; }
}

function doLogout() {
  localStorage.removeItem('diddyrng_token');
  currentUser = null;
  showScreen('auth');
}

// ===== LEADERBOARD =====
async function fetchLeaderboard() {
  const listEl = document.getElementById('lbList');
  if (!listEl) return;
  listEl.innerHTML = '<div class="lb-loading">Loading…</div>';
  try {
    const { ok, data } = await apiGet('/leaderboard');
    if (!ok || !data.entries || data.entries.length === 0) {
      listEl.innerHTML = '<div class="lb-empty">No rolls recorded yet — be the first!</div>';
      return;
    }
    listEl.innerHTML = '';
    const medals = ['🥇','🥈','🥉'];
    data.entries.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'lb-row';
      const badge = entry.rank <= 3 ? medals[entry.rank - 1] : `#${entry.rank}`;
      const mutText = entry.mutation ? ` · ${entry.mutation}` : '';
      row.innerHTML = `
        <span class="lb-rank">${badge}</span>
        <div class="lb-info">
          <div class="lb-player">${entry.email}</div>
          <div class="lb-roll" style="color:${entry.color || '#c8d6ff'}">${entry.rarityLabel} — ${entry.rollName}${mutText}</div>
        </div>`;
      listEl.appendChild(row);
    });
  } catch {
    listEl.innerHTML = '<div class="lb-empty">Failed to load leaderboard.</div>';
  }
}

async function recordRoll(idx, rarity, itemName, mutation) {
  if (!currentUser) return;
  try {
    await apiPost('/leaderboard/record', {
      rarityIdx: idx,
      rarityId: rarity.id,
      rarityLabel: rarity.label,
      rollName: itemName,
      mutation: mutation ? `${mutation.icon} ${mutation.label}` : null,
      color: rarity.color,
    });
  } catch { /* fire and forget */ }
}

// ===== PLAYERS ADMIN =====
async function loadPlayers() {
  const listEl = document.getElementById('playersList');
  const wrap = document.getElementById('playersListWrap');
  listEl.innerHTML = '<div style="color:var(--text-dim);padding:8px 0">Loading…</div>';
  wrap.classList.remove('hidden');
  try {
    const { ok, data } = await apiAdminGet('/admin/users');
    if (!ok) { listEl.innerHTML = '<div style="color:#ff5f87">Failed to load players.</div>'; return; }
    if (!data.users || data.users.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text-dim);padding:8px 0">No registered players.</div>';
      return;
    }
    listEl.innerHTML = '';
    data.users.forEach(user => {
      const row = document.createElement('div');
      row.className = `player-row${user.isBanned ? ' banned' : ''}`;
      const verifiedIcon = user.isVerified ? '✓ Verified' : '✗ Unverified';
      const bannedBadge = user.isBanned ? ' &nbsp;🚫 Banned' : '';
      row.innerHTML = `
        <div class="player-email">${user.email}</div>
        <div class="player-meta">${verifiedIcon}${bannedBadge}${user.banReason ? ` — ${user.banReason}` : ''}</div>
        <div class="player-actions">
          ${!user.isBanned
            ? `<input class="player-ban-input" placeholder="Ban reason (optional)" id="banReason_${user.id}">
               <button class="player-ban-btn ban" onclick="playerBan('${user.email}', ${user.id})">Ban</button>`
            : `<button class="player-ban-btn unban" onclick="playerUnban('${user.email}')">Unban</button>`
          }
        </div>`;
      listEl.appendChild(row);
    });
  } catch { listEl.innerHTML = '<div style="color:#ff5f87">Network error.</div>'; }
}

async function playerBan(email, id) {
  const reasonEl = document.getElementById(`banReason_${id}`);
  const reason = reasonEl ? reasonEl.value.trim() : '';
  const { ok } = await apiAdminPost('/admin/ban', { email, reason: reason || 'Banned by admin' });
  if (ok) loadPlayers();
}

async function playerUnban(email) {
  const { ok } = await apiAdminPost('/admin/unban', { email });
  if (ok) loadPlayers();
}

// ===== RARITY DATA =====
const RARITIES = [
  { id:"common",       label:"Common",       color:"#9aacb8", chance:29.998889, icon:"⬜", oneIn:"3",                items:["Gray Mist","Dust Wisp","Pale Wind","Stone Shard","Faded Ash"] },
  { id:"uncommon",     label:"Uncommon",     color:"#5dde77", chance:20,        icon:"🍃", oneIn:"5",                items:["Forest Veil","Emerald Fog","Vine Pulse","Mossy Glow","Sprout Flare"] },
  { id:"rare",         label:"Rare",         color:"#4da8ff", chance:25,        icon:"🌊", oneIn:"4",                items:["Tide Aura","Azure Pulse","Ocean Rift","Sapphire Wake","Deep Current"] },
  { id:"epic",         label:"Epic",         color:"#b46bff", chance:15,        icon:"💜", oneIn:"7",                items:["Void Shroud","Shadow Bloom","Arcane Rift","Spectral Surge","Nether Glow"] },
  { id:"legendary",    label:"Legendary",    color:"#ffb347", chance:6,         icon:"🔥", oneIn:"17",               items:["Solar Flare","Phoenix Burst","Amber Titan","Ember Crown","Inferno Core"] },
  { id:"mythical",     label:"Mythical",     color:"#ff5f87", chance:3,         icon:"🌸", oneIn:"33",               items:["Blossom Storm","Sakura Nova","Rose Specter","Crimson Bloom","Petal Wraith"] },
  { id:"divine",       label:"Divine",       color:"#ffe95e", chance:0.7,       icon:"✨", oneIn:"143",              items:["Gilded Halo","Sol's Radiance","Heaven's Edge","Sacred Light","Dawn Aureole"] },
  { id:"celestial",    label:"Celestial",    color:"#62ffe8", chance:0.25,      icon:"🌌", oneIn:"400",              items:["Nebula Wraith","Starfall Veil","Comet Trail","Galactic Mist","Void Horizon"] },
  { id:"cosmic",       label:"Cosmic",       color:"#ff84ff", chance:0.04,      icon:"🪐", oneIn:"2,500",            items:["Planet Shard","Cosmic Rift","Quasar Pulse","Dark Matter","Ring Wraith"] },
  { id:"eternal",      label:"Eternal",      color:"#ffffff", chance:0.01,      icon:"♾️", oneIn:"10,000",           items:["Eternal Flame","Infinite Void","Omni Sol","The Absolute","Zero Point"] },
  { id:"transcendent", label:"Transcendent", color:"#a0ffb0", chance:0.001,     icon:"🌠", oneIn:"100,000",          items:["Transcended Flame","Beyond-Light","Fading Stars","Echo of Eternity","Void Walker"] },
  { id:"omnipotent",   label:"Omnipotent",   color:"#ffd700", chance:0.0001,    icon:"👁️", oneIn:"1 Million",        items:["All-Seeing Eye","Omnipotent Surge","Power Supreme","Infinite Will","Creator's Spark"] },
  { id:"astral",       label:"Astral",       color:"#00e5ff", chance:0.00001,   icon:"💫", oneIn:"10 Million",       items:["Astral Projection","Star Weave","Prismatic Soul","Drift of Aeons","Spectral Tide"] },
  { id:"sovereign",    label:"Sovereign",    color:"#ff6d00", chance:0.000001,  icon:"👑", oneIn:"100 Million",      items:["King's Decree","Sovereign Blaze","Iron Throne","Ruling Light","Apex Dominion"] },
  { id:"godly",        label:"Godly",        color:"#ffee00", chance:1e-7,      icon:"⚡", oneIn:"1 Billion",        items:["Divine Thunder","Godly Strike","Holy Tempest","Olympian Surge","Zeus's Bolt"] },
  { id:"primordial",   label:"Primordial",   color:"#ff0080", chance:1e-8,      icon:"🔱", oneIn:"10 Billion",       items:["First Flame","Origin Pulse","Ancient Rift","Primal Roar","Genesis Tear"] },
  { id:"apex",         label:"Apex",         color:"#00ff6e", chance:1e-9,      icon:"🦅", oneIn:"100 Billion",      items:["Peak Predator","Summit Aura","Pinnacle Storm","Apex Ascent","Crown of Kings"] },
  { id:"singularity",  label:"Singularity",  color:"#9900ff", chance:1e-10,     icon:"🕳️", oneIn:"1 Trillion",      items:["Black Hole Birth","Event Horizon","Collapsed Star","Void Singularity","Dark Infinity"] },
  { id:"nebular",      label:"Nebular",      color:"#ff55ff", chance:1e-11,     icon:"🌫️", oneIn:"10 Trillion",     items:["Nebula Born","Cloud of Worlds","Star Nursery","Cosmic Cradle","Hydrogen Veil"] },
  { id:"galactic",     label:"Galactic",     color:"#0088ff", chance:1e-12,     icon:"🌀", oneIn:"100 Trillion",     items:["Galaxy Core","Spiral Arm","Milky Wraith","Andromeda Pulse","Black Arm Nova"] },
  { id:"universal",    label:"Universal",    color:"#ffff44", chance:1e-13,     icon:"🌍", oneIn:"1 Quadrillion",    items:["Universe's Edge","Expansion Tide","All-Space Veil","Big Bang Echo","Cosmic Web"] },
  { id:"multiversal",  label:"Multiversal",  color:"#ff3300", chance:1e-14,     icon:"🪞", oneIn:"10 Quadrillion",   items:["Mirror World","Parallel Flame","Branching Void","Infinite Earths","Alt-Sol"] },
  { id:"omniversal",   label:"Omniversal",   color:"#aaff00", chance:1e-15,     icon:"🔮", oneIn:"100 Quadrillion",  items:["Omni Sphere","All-Realm Surge","Beyond Canon","Reality Weave","True Omni"] },
  { id:"infinite",     label:"Infinite",     color:"#4466ff", chance:1e-16,     icon:"🌟", oneIn:"1 Quintillion",    items:["Endless Flame","Boundless Void","Limitless Sol","Eternity's Core","No-End Aura"] },
  { id:"absolute",     label:"Absolute",     color:"#ff00ff", chance:1e-17,     icon:"💠", oneIn:"10 Quintillion",   items:["Absolute Zero","Final Truth","True Absolute","Terminus Glow","The Last Light"] },
  { id:"beyond",       label:"BEYOND",       color:"#ffffff", chance:1e-18,     icon:"💎", oneIn:"100 Quintillion",  items:["The BEYOND","Transcendence","Sol's Secret","∞ Aura","True Ending"] }
];

// ===== MUTATIONS =====
const MUTATIONS = [
  // ── COMMON ──────────────────────────────────────────────
  { id:"shiny",       label:"Shiny",       icon:"✨", color:"#fff9c4", border:"#ffd700", chance:0.10,      tier:"common",    oneIn:"10" },
  { id:"frosty",      label:"Frosty",      icon:"❄️", color:"#b3e5fc", border:"#29b6f6", chance:0.08,      tier:"common",    oneIn:"12" },
  { id:"blazing",     label:"Blazing",     icon:"🔥", color:"#ffcc80", border:"#ff6d00", chance:0.06,      tier:"common",    oneIn:"17" },
  { id:"toxic",       label:"Toxic",       icon:"☢️", color:"#ccff90", border:"#76ff03", chance:0.045,     tier:"common",    oneIn:"22" },
  { id:"glowing",     label:"Glowing",     icon:"💫", color:"#80d8ff", border:"#4da8ff", chance:0.03,      tier:"common",    oneIn:"33" },
  { id:"neon",        label:"Neon",        icon:"🌈", color:"#ff80ab", border:"#ff1744", chance:0.025,     tier:"common",    oneIn:"40" },
  // ── UNCOMMON ────────────────────────────────────────────
  { id:"electric",    label:"Electric",    icon:"⚡", color:"#ffee58", border:"#fdd835", chance:0.015,     tier:"uncommon",  oneIn:"67" },
  { id:"golden",      label:"Golden",      icon:"🌟", color:"#ffd700", border:"#ff8800", chance:0.01,      tier:"uncommon",  oneIn:"100" },
  { id:"crystal",     label:"Crystal",     icon:"💎", color:"#e0f7fa", border:"#00e5ff", chance:0.006,     tier:"uncommon",  oneIn:"167" },
  { id:"spectral",    label:"Spectral",    icon:"👻", color:"#e8eaf6", border:"#9fa8da", chance:0.004,     tier:"uncommon",  oneIn:"250" },
  { id:"shadow",      label:"Shadow",      icon:"🌑", color:"#9575cd", border:"#4527a0", chance:0.0025,    tier:"uncommon",  oneIn:"400" },
  // ── RARE ────────────────────────────────────────────────
  { id:"cursed",      label:"Cursed",      icon:"💀", color:"#d070ff", border:"#8800ee", chance:0.0015,    tier:"rare",      oneIn:"667" },
  { id:"infernal",    label:"Infernal",    icon:"😈", color:"#ff5722", border:"#b71c1c", chance:0.0008,    tier:"rare",      oneIn:"1,250" },
  { id:"phantom",     label:"Phantom",     icon:"🌫️", color:"#cfd8dc", border:"#607d8b", chance:0.0004,    tier:"rare",      oneIn:"2,500" },
  { id:"molten",      label:"Molten",      icon:"🌋", color:"#ff8f00", border:"#e65100", chance:0.0002,    tier:"rare",      oneIn:"5,000" },
  // ── EPIC ────────────────────────────────────────────────
  { id:"corrupted",   label:"Corrupted",   icon:"☠️", color:"#ff4444", border:"#cc0000", chance:0.00008,   tier:"epic",      oneIn:"12,500" },
  { id:"temporal",    label:"Temporal",    icon:"⏳", color:"#ffe082", border:"#ff8f00", chance:0.00003,   tier:"epic",      oneIn:"33,333" },
  { id:"quantum",     label:"Quantum",     icon:"🔬", color:"#80cbc4", border:"#00897b", chance:0.00001,   tier:"epic",      oneIn:"100,000" },
  // ── LEGENDARY ───────────────────────────────────────────
  { id:"astral",      label:"Astral",      icon:"🌌", color:"#00e5ff", border:"#0088ff", chance:0.000003,  tier:"legendary", oneIn:"333,333" },
  { id:"prismatic",   label:"Prismatic",   icon:"🔮", color:"#ff80ff", border:"#cc00ff", chance:0.000001,  tier:"legendary", oneIn:"1 Million" },
  { id:"dimensional", label:"Dimensional", icon:"🌀", color:"#64b5f6", border:"#1565c0", chance:3e-7,      tier:"legendary", oneIn:"3.3 Million" },
  // ── MYTHICAL ────────────────────────────────────────────
  { id:"void",        label:"VOID",        icon:"🕳️", color:"#bb44ff", border:"#440088", chance:5e-8,      tier:"mythical",  oneIn:"20 Million" },
  { id:"apocalyptic", label:"Apocalyptic", icon:"💥", color:"#ff1744", border:"#880000", chance:1e-8,      tier:"mythical",  oneIn:"100 Million" },
  { id:"omega",       label:"OMEGA",       icon:"⚛️", color:"#ffffff", border:"#aa88ff", chance:1e-9,      tier:"mythical",  oneIn:"1 Billion" },
];

function rollMutation() {
  // Check rarest to most common — first match wins
  for (let i = MUTATIONS.length - 1; i >= 0; i--) {
    if (Math.random() < MUTATIONS[i].chance) return MUTATIONS[i];
  }
  return null;
}

// ===== EVENTS =====
const EVENTS = [
  { id:"lucky_hour",   name:"Lucky Hour!",    icon:"⭐", color:"#ffd700", desc:"Rare+ chances tripled!",      duration:60000, effect:"luck_boost",   multiplier:3 },
  { id:"meteor",       name:"Meteor Shower!", icon:"☄️", color:"#4da8ff", desc:"5 free random items incoming!", duration:8000,  effect:"meteor_shower",multiplier:1 },
  { id:"curse",        name:"The Curse!",     icon:"💀", color:"#ff5f87", desc:"Only Common & Uncommon...",     duration:30000, effect:"curse",        multiplier:1 },
  { id:"golden_rush",  name:"Golden Rush!",   icon:"🌟", color:"#ffb347", desc:"Legendary+ rates doubled!",    duration:45000, effect:"golden_rush",  multiplier:2 },
  { id:"blood_moon",   name:"Blood Moon!",    icon:"🌙", color:"#ff0080", desc:"Mythical+ chances ×5!",        duration:30000, effect:"blood_moon",   multiplier:5 },
  { id:"sol_blessing", name:"Sol's Blessing!",icon:"☀️", color:"#fff7a0", desc:"ALL rarities get ×10 luck!",  duration:20000, effect:"sol_blessing", multiplier:10 }
];

// ===== STATE =====
let inventory = {};       // { key: { rarity, name, count, mutation } }
let equippedKey = null;   // key of equipped item
let totalRolls = 0;
let luckMultiplier = 1;
let rollHistory = [];     // last 10 { rarity, mutation }
let isRolling = false;
let adminUnlocked = false;
let activeEvent = null;   // { event, endTime, timerId }
let lastResultData = null;// { rarity, itemName } for equip from result overlay
let autoRollInterval = null;
let autoRollCount = 0;

// ===== DOM REFS =====
const $ = id => document.getElementById(id);
const noob = $("noob");
const noobScene = $("noobScene");
const equippedTag = $("equippedTag");
const equippedTagText = $("equippedTagText");
const lastRollIcon = $("lastRollIcon");
const lastRollName = $("lastRollName");
const lastRollRarity = $("lastRollRarity");
const rollBtn = $("rollBtn");
const rollBtnText = $("rollBtnText");
const totalRollsEl = $("totalRolls");
const multiplierDisplay = $("multiplierDisplay");
const invCount = $("invCount");
const inventoryGrid = $("inventoryGrid");
const invEquippedBadge = $("invEquippedBadge");
const invEquippedName = $("invEquippedName");
const rarityTableEl = $("rarityTable");
const eventBanner = $("eventBanner");
const eventIconWrap = $("eventIconWrap");
const eventName = $("eventName");
const eventDesc = $("eventDesc");
const eventTimer = $("eventTimer");
const adminModal = $("adminModal");
const adminLock = $("adminLock");
const adminTools = $("adminTools");
const adminPasscode = $("adminPasscode");
const adminError = $("adminError");
const giveRaritySelect = $("giveRaritySelect");
const giveMutationSelect = $("giveMutationSelect");
const giveQty = $("giveQty");
const luckValueInput = $("luckValueInput");
const eventSelect = $("eventSelect");
const adminLog = $("adminLog");
const resultOverlay = $("resultOverlay");
const resultCard = $("resultCard");
const resultIcon = $("resultIcon");
const resultLabel = $("resultLabel");
const resultName = $("resultName");
const resultChance = $("resultChance");
const resultEquipBtn = $("resultEquipBtn");
const resultClose = $("resultClose");

// ===== AURA TIER MAP =====
const AURA_TIER = {
  common:0, uncommon:0,
  rare:1, epic:1,
  legendary:2, mythical:2,
  divine:3, celestial:3,
  cosmic:4, eternal:4,
  transcendent:5, omnipotent:5,
  astral:6, sovereign:6,
  godly:7, primordial:7,
  apex:8, singularity:8, nebular:8, galactic:8,
  universal:9, multiversal:9, omniversal:9, infinite:9,
  absolute:9, beyond:10
};

// ===== INIT =====
const MUT_TIER_META = {
  common:    { label: "Common",    color: "#aaaaaa" },
  uncommon:  { label: "Uncommon",  color: "#4caf50" },
  rare:      { label: "Rare",      color: "#2196f3" },
  epic:      { label: "Epic",      color: "#9c27b0" },
  legendary: { label: "Legendary", color: "#ff9800" },
  mythical:  { label: "Mythical",  color: "#ff1744" },
};

function buildMutationsTable() {
  const container = $("mutationsTable");
  if (!container) return;
  container.innerHTML = "";
  let lastTier = null;
  for (const m of MUTATIONS) {
    if (m.tier !== lastTier) {
      lastTier = m.tier;
      const meta = MUT_TIER_META[m.tier];
      const hdr = document.createElement("div");
      hdr.style.cssText = "grid-column:1/-1;";
      hdr.innerHTML = `<div class="mut-tier-badge"><div class="mut-tier-line"></div><span class="mut-tier-label" style="color:${meta.color}">${meta.label}</span><div class="mut-tier-line"></div></div>`;
      container.appendChild(hdr);
    }
    const row = document.createElement("div");
    row.className = "mut-row";
    row.style.setProperty("--mut-c", m.border);
    row.innerHTML = `
      <span class="mut-row-icon">${m.icon}</span>
      <div class="mut-row-info">
        <div class="mut-row-name" style="color:${m.color}">${m.label}</div>
        <div class="mut-row-tier">${MUT_TIER_META[m.tier].label}</div>
      </div>
      <div class="mut-row-odds">1 in ${m.oneIn}</div>`;
    container.appendChild(row);
  }
}

function init() {
  generateStars();
  buildRarityTable();
  buildMutationsTable();
  buildAdminSelect();
  buildEventSelect();
  loadState();
  renderInventory();
  applyAura(equippedKey ? inventory[equippedKey]?.rarity : null);
  updateEquippedUI();

  $("equipBestBtn").addEventListener("click", equipBest);
  rollBtn.addEventListener("click", doRoll);
  $("adminBtn").addEventListener("click", openAdmin);
  $("adminClose").addEventListener("click", closeAdmin);
  adminModal.addEventListener("click", e => { if (e.target === adminModal) closeAdmin(); });
  $("adminSubmit").addEventListener("click", submitPasscode);
  adminPasscode.addEventListener("keydown", e => { if (e.key === "Enter") submitPasscode(); });
  $("giveItemBtn").addEventListener("click", adminGiveItem);
  $("setMultiplierBtn").addEventListener("click", adminSetMultiplier);
  $("triggerEventBtn").addEventListener("click", adminTriggerEvent);
  $("resetRollsBtn").addEventListener("click", adminResetRolls);
  $("endEventBtn").addEventListener("click", adminEndEvent);
  $("resetMultiplierBtn").addEventListener("click", adminResetMultiplier);
  $("resetInventoryBtn").addEventListener("click", adminResetAll);
  $("addLuckBtn").addEventListener("click", adminAddLuck);
  $("subLuckBtn").addEventListener("click", adminSubLuck);
  // Luck preset buttons
  document.querySelectorAll(".luck-preset").forEach(btn => {
    btn.addEventListener("click", () => {
      luckValueInput.value = btn.dataset.val;
      document.querySelectorAll(".luck-preset").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
  });
  resultEquipBtn.addEventListener("click", equipFromResult);
  resultClose.addEventListener("click", closeResult);
  resultOverlay.addEventListener("click", e => { if (e.target === resultOverlay) closeResult(); });

  // Lucky Boost
  $("luckyBoostBtn").addEventListener("click", activateLuckyBoost);

  // Auto roll
  $("autoRollBtn").addEventListener("click", toggleAutoRoll);
  $("autoSpeedSelect").addEventListener("change", () => {
    if (autoRollInterval) { stopAutoRoll(); startAutoRoll(); } // restart at new speed
  });

  // Random event scheduler
  scheduleNextEvent();

  // Players admin button
  const loadPlayersBtn = $("loadPlayersBtn");
  if (loadPlayersBtn) loadPlayersBtn.addEventListener("click", loadPlayers);
}

// ===== STARS =====
function generateStars() {
  const container = $("stars");
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 130; i++) {
    const s = document.createElement("div");
    s.className = "star";
    const size = Math.random() * 2.5 + 0.5;
    s.style.cssText = `width:${size}px;height:${size}px;top:${Math.random()*100}%;left:${Math.random()*100}%;--dur:${(Math.random()*3+2).toFixed(1)}s;--delay:${(Math.random()*4).toFixed(1)}s;opacity:${Math.random()*.6+.1};`;
    frag.appendChild(s);
  }
  container.appendChild(frag);
}

// ===== RARITY TABLE =====
function buildRarityTable() {
  rarityTableEl.innerHTML = "";
  for (const r of RARITIES) {
    const row = document.createElement("div");
    row.className = "rarity-row";
    row.style.setProperty("--row-color", r.color);
    row.innerHTML = `
      <div class="rarity-left">
        <div class="rarity-dot" style="background:${r.color};box-shadow:0 0 6px ${r.color}"></div>
        <span class="rarity-label" style="color:${r.color}">${r.label}</span>
        <span class="rarity-icon">${r.icon}</span>
      </div>
      <div class="rarity-chance">
        ${formatPct(r.chance)}
        <span class="one-in">1 in ${r.oneIn}</span>
      </div>`;
    rarityTableEl.appendChild(row);
  }
}

function formatPct(chance) {
  if (chance >= 1) return `${Math.round(chance)}%`;
  if (chance >= 0.001) return `${chance}%`;
  const exp = Math.round(-Math.log10(chance));
  return `10<sup>-${exp}</sup>%`;
}

// ===== ROLL LOGIC =====
function buildWeightedList() {
  // Apply active event and luck multiplier
  if (!activeEvent) {
    return applyLuckMult(RARITIES.map(r => ({ rarity:r, weight:r.chance })));
  }
  const effect = activeEvent.event.effect;
  if (effect === "curse") {
    const cursed = RARITIES.slice(0,2).map(r => ({ rarity:r, weight:r.chance }));
    return normalize(cursed);
  }
  const rareMult = activeEvent.event.multiplier || 1;
  let modified;
  if (effect === "luck_boost") {
    modified = RARITIES.map((r,i) => ({ rarity:r, weight: i >= 2 ? r.chance * rareMult : r.chance }));
  } else if (effect === "golden_rush") {
    modified = RARITIES.map((r,i) => ({ rarity:r, weight: i >= 4 ? r.chance * rareMult : r.chance }));
  } else if (effect === "blood_moon") {
    modified = RARITIES.map((r,i) => ({ rarity:r, weight: i >= 5 ? r.chance * rareMult : r.chance }));
  } else if (effect === "sol_blessing") {
    modified = RARITIES.map((r,i) => ({ rarity:r, weight: i >= 2 ? r.chance * rareMult : r.chance }));
  } else {
    modified = RARITIES.map(r => ({ rarity:r, weight:r.chance }));
  }
  return applyLuckMult(modified);
}

function applyLuckMult(entries) {
  if (luckMultiplier === 1) return normalize(entries);
  // Apply from index 1 (Uncommon+) so even small boosts feel impactful
  return normalize(entries.map((e, i) => ({ ...e, weight: i >= 1 ? e.weight * luckMultiplier : e.weight })));
}

function normalize(entries) {
  const total = entries.reduce((s,e) => s + e.weight, 0);
  let cumulative = 0;
  return entries.map(e => { cumulative += e.weight; return { ...e, threshold: (cumulative / total) * 100 }; });
}

function rollRarityResult() {
  const weighted = buildWeightedList();
  const rand = Math.random() * 100;
  for (const entry of weighted) {
    if (rand < entry.threshold) return entry.rarity;
  }
  return RARITIES[0];
}

function pickItem(rarity) {
  return rarity.items[Math.floor(Math.random() * rarity.items.length)];
}

// ===== ROLL =====
function doRoll() {
  if (isRolling) return;
  isRolling = true;
  rollBtn.disabled = true;
  const noobEl = document.getElementById("noob");
  if (noobEl) noobEl.classList.add("rolling");

  const result = rollRarityResult();
  const mutation = rollMutation();
  const itemName = pickItem(result);
  totalRolls++;
  totalRollsEl.textContent = totalRolls.toLocaleString();
  addRollHistory(result, mutation);

  let frames = 0;
  const maxFrames = ["common","uncommon"].includes(result.id) ? 10 : 18;
  const interval = setInterval(() => {
    const fake = RARITIES[Math.floor(Math.random() * 4)];
    lastRollIcon.textContent = fake.icon;
    lastRollName.textContent = "Rolling...";
    lastRollRarity.textContent = "✦ ✦ ✦";
    lastRollRarity.style.color = fake.color;
    frames++;
    if (frames >= maxFrames) {
      clearInterval(interval);
      revealResult(result, itemName, mutation);
    }
  }, 80);
}

function revealResult(rarity, itemName, mutation = null) {
  const noobEl = document.getElementById("noob");
  if (noobEl) {
    noobEl.classList.remove("rolling");
    noobEl.classList.add("pop");
    setTimeout(() => noobEl.classList.remove("pop"), 500);
  }

  lastRollIcon.textContent = rarity.icon;
  lastRollName.textContent = itemName;
  if (mutation) {
    lastRollRarity.textContent = `${rarity.label.toUpperCase()} · ${mutation.icon} ${mutation.label}`;
    lastRollRarity.style.color = mutation.color;
  } else {
    lastRollRarity.textContent = rarity.label.toUpperCase();
    lastRollRarity.style.color = rarity.color;
  }

  addToInventory(rarity, itemName, mutation);
  lastResultData = { rarity, itemName, mutation };

  const idx = RARITIES.findIndex(r => r.id === rarity.id);
  recordRoll(idx, rarity, itemName, mutation);
  if (idx >= 4) {
    // Legendary+ gets the cinematic dark screen reveal first
    showEpicReveal(rarity, mutation, () => showResultOverlay(rarity, itemName, mutation));
  } else if (mutation) {
    showResultOverlay(rarity, itemName, mutation);
  } else {
    finishRoll();
  }
}

function showEpicReveal(rarity, mutation, callback) {
  const overlay   = $("epicReveal");
  const bg        = $("epicRevealBg");
  const iconEl    = $("epicRevealIcon");
  const labelEl   = $("epicRevealLabel");
  const mutEl     = $("epicRevealMut");

  const color = mutation ? mutation.border : rarity.color;

  overlay.style.setProperty("--epic-color", color);
  bg.style.background = `radial-gradient(ellipse at 50% 50%, ${color}22 0%, #000 65%)`;
  iconEl.textContent  = rarity.icon;
  labelEl.textContent = rarity.label.toUpperCase();

  if (mutation) {
    mutEl.textContent  = `${mutation.icon} ${mutation.label.toUpperCase()} MUTATION`;
    mutEl.style.color  = mutation.color;
  } else {
    mutEl.textContent = "";
  }

  overlay.classList.add("show");

  // Hold for 2.8s then fade out, then show result overlay
  setTimeout(() => {
    overlay.classList.remove("show");
    setTimeout(callback, 500);
  }, 2800);
}

function equipBest() {
  const keys = Object.keys(inventory);
  if (!keys.length) return;

  const rarityRank  = key => RARITIES.findIndex(r => r.id === inventory[key].rarity.id);
  const mutRank     = key => inventory[key].mutation
    ? MUTATIONS.findIndex(m => m.id === inventory[key].mutation.id) + 1
    : 0;

  const bestKey = keys.reduce((best, k) => {
    const ra = rarityRank(k), rb = rarityRank(best);
    if (ra !== rb) return ra > rb ? k : best;
    return mutRank(k) > mutRank(best) ? k : best;
  }, keys[0]);

  equipItem(bestKey);
}

function finishRoll() {
  isRolling = false;
  // Don't re-enable rollBtn during auto-roll; auto handles its own timing
  if (!autoRollInterval) rollBtn.disabled = false;
}

// ===== AUTO ROLL =====
function toggleAutoRoll() {
  if (autoRollInterval) {
    stopAutoRoll();
  } else {
    startAutoRoll();
  }
}

function startAutoRoll() {
  const speed = parseInt($("autoSpeedSelect").value) || 1000;
  autoRollCount = 0;
  $("autoStatSep").style.display = "";
  $("autoStatItem").style.display = "";

  // Disable the manual roll button during auto
  rollBtn.disabled = true;

  // For fast speeds, we skip the roll animation frames to keep up
  const useFastMode = speed <= 200;

  const autoRollBtn = $("autoRollBtn");
  autoRollBtn.classList.add("active");
  autoRollBtn.textContent = "■ STOP AUTO";

  autoRollInterval = setInterval(() => {
    if (isRolling && !useFastMode) return; // wait for current roll to finish
    if (useFastMode) {
      // Instant roll — no animation, just result
      const result = rollRarityResult();
      const mutation = rollMutation();
      const itemName = pickItem(result);
      totalRolls++;
      autoRollCount++;
      totalRollsEl.textContent = totalRolls.toLocaleString();
      $("autoRollsDisplay").textContent = autoRollCount.toLocaleString();
      lastRollIcon.textContent = result.icon;
      lastRollName.textContent = itemName;
      if (mutation) {
        lastRollRarity.textContent = `${result.label.toUpperCase()} · ${mutation.icon} ${mutation.label}`;
        lastRollRarity.style.color = mutation.color;
      } else {
        lastRollRarity.textContent = result.label.toUpperCase();
        lastRollRarity.style.color = result.color;
      }
      addRollHistory(result, mutation);
      addToInventory(result, itemName, mutation);
      // Don't show popup in ultra-fast mode to avoid interruptions
    } else {
      // Normal roll with animation
      autoRollCount++;
      $("autoRollsDisplay").textContent = autoRollCount.toLocaleString();
      doRoll();
    }
  }, speed);
}

// ===== LUCKY BOOST =====
let luckyBoostTimer = null;
function activateLuckyBoost() {
  const btn = $("luckyBoostBtn");
  const hint = $("luckyBoostHint");
  if (btn.disabled) return;
  btn.disabled = true;

  const BOOST = 3;
  const DURATION = 20000;
  luckMultiplier = Math.max(luckMultiplier, BOOST);
  updateLuckDisplays();

  let remaining = Math.ceil(DURATION / 1000);
  hint.textContent = `🍀 ${remaining}s remaining…`;
  hint.classList.add("active");

  clearInterval(luckyBoostTimer);
  luckyBoostTimer = setInterval(() => {
    remaining--;
    hint.textContent = remaining > 0 ? `🍀 ${remaining}s remaining…` : "3× luck for 20s — free!";
    if (remaining <= 0) {
      clearInterval(luckyBoostTimer);
      if (luckMultiplier === BOOST) {
        luckMultiplier = 1;
        updateLuckDisplays();
      }
      hint.classList.remove("active");
      // Cooldown: re-enable after 60s
      hint.textContent = "Recharging…";
      setTimeout(() => {
        btn.disabled = false;
        hint.textContent = "3× luck for 20s — free!";
      }, 60000);
    }
  }, 1000);
}

function stopAutoRoll() {
  clearInterval(autoRollInterval);
  autoRollInterval = null;
  isRolling = false;
  rollBtn.disabled = false;
  const autoRollBtn = $("autoRollBtn");
  autoRollBtn.classList.remove("active");
  autoRollBtn.textContent = "⟳ AUTO ROLL";
  $("autoStatSep").style.display = "none";
  $("autoStatItem").style.display = "none";
}

// ===== ROLL HISTORY =====
function addRollHistory(rarity, mutation) {
  rollHistory.unshift({ rarity, mutation });
  if (rollHistory.length > 10) rollHistory.pop();
  renderRollHistory();
}

function renderRollHistory() {
  const el = $("rollHistory");
  if (!el) return;
  el.innerHTML = rollHistory.map(r => {
    const border = r.mutation ? `2px solid ${r.mutation.border}` : `1.5px solid ${r.rarity.color}44`;
    const bg = `${r.rarity.color}22`;
    const title = r.rarity.label + (r.mutation ? ` · ${r.mutation.label}` : "");
    return `<span class="roll-hist-dot" style="background:${bg};border:${border}" title="${title}">${r.rarity.icon}</span>`;
  }).join("");
}

// ===== RESULT OVERLAY =====
function showResultOverlay(rarity, itemName, mutation = null) {
  resultCard.style.setProperty("--card-color", mutation ? mutation.border : rarity.color);
  resultIcon.textContent = rarity.icon;
  resultLabel.textContent = rarity.label.toUpperCase();
  resultLabel.style.color = rarity.color;
  resultLabel.style.textShadow = `0 0 20px ${rarity.color}`;
  resultName.textContent = itemName;
  resultChance.textContent = `1 in ${rarity.oneIn}`;

  const mutBadge = $("resultMutation");
  if (mutBadge) {
    if (mutation) {
      mutBadge.textContent = `${mutation.icon} ${mutation.label.toUpperCase()} MUTATION`;
      mutBadge.style.color = mutation.color;
      mutBadge.style.borderColor = mutation.border;
      mutBadge.style.textShadow = `0 0 12px ${mutation.color}`;
      mutBadge.style.background = `${mutation.border}22`;
      mutBadge.style.display = "inline-block";
    } else {
      mutBadge.style.display = "none";
    }
  }

  resultOverlay.classList.remove("hidden");
}

function equipFromResult() {
  if (lastResultData) {
    const { rarity, itemName, mutation } = lastResultData;
    const mutId = mutation ? mutation.id : "none";
    const key = `${itemName}__${rarity.id}__${mutId}`;
    equipItem(key);
  }
  closeResult();
}

function closeResult() {
  resultOverlay.classList.add("hidden");
  finishRoll();
}

// ===== INVENTORY =====
function addToInventory(rarity, itemName, mutation = null) {
  const mutId = mutation ? mutation.id : "none";
  const key = `${itemName}__${rarity.id}__${mutId}`;
  if (inventory[key]) {
    inventory[key].count++;
  } else {
    inventory[key] = { rarity, name: itemName, count: 1, mutation };
  }
  saveState();
  renderInventory();
}

function equipItem(key) {
  if (!inventory[key]) return;
  equippedKey = key;
  const { rarity, mutation } = inventory[key];
  applyAura(rarity, mutation);
  updateEquippedUI();
  renderInventory();
  saveState();
}

function unequipItem() {
  equippedKey = null;
  applyAura(null);
  updateEquippedUI();
  renderInventory();
  saveState();
}

function updateEquippedUI() {
  if (equippedKey && inventory[equippedKey]) {
    const { rarity, name } = inventory[equippedKey];
    equippedTagText.textContent = `${rarity.icon} ${name}`;
    equippedTag.classList.add("has-aura");
    equippedTag.style.setProperty("--aura-color", rarity.color);
    invEquippedBadge.classList.remove("hidden");
    invEquippedName.textContent = `${rarity.icon} ${name} equipped`;
  } else {
    equippedTagText.textContent = "No aura equipped";
    equippedTag.classList.remove("has-aura");
    invEquippedBadge.classList.add("hidden");
  }
}

function renderInventory() {
  const items = Object.entries(inventory);
  const totalItems = items.reduce((s,[,v]) => s + v.count, 0);
  invCount.textContent = `(${totalItems} item${totalItems !== 1 ? "s" : ""})`;

  if (items.length === 0) {
    inventoryGrid.innerHTML = '<div class="inv-empty">Roll to start collecting items!</div>';
    return;
  }

  // Sort rarest first
  items.sort(([,a],[,b]) => {
    const ai = RARITIES.findIndex(r => r.id === a.rarity.id);
    const bi = RARITIES.findIndex(r => r.id === b.rarity.id);
    return bi - ai;
  });

  inventoryGrid.innerHTML = "";
  for (const [key, item] of items) {
    const mut = item.mutation;
    const cls = "inv-item" + (key === equippedKey ? " equipped" : "") + (mut ? " mutated" : "");
    const el = document.createElement("div");
    el.className = cls;
    el.style.setProperty("--item-color", mut ? mut.border : item.rarity.color);
    if (mut) el.style.setProperty("--mut-color", mut.color);
    const mutLabel = mut ? ` [${mut.label}]` : "";
    el.title = key === equippedKey
      ? `${item.name}${mutLabel} — Equipped (click to unequip)`
      : `${item.name}${mutLabel} (${item.rarity.label}) — Click to equip`;
    el.innerHTML = `
      ${item.count > 1 ? `<div class="inv-item-count">×${item.count}</div>` : ""}
      ${mut ? `<div class="inv-item-mut">${mut.icon}</div>` : ""}
      <span class="inv-item-icon">${item.rarity.icon}</span>
      <div class="inv-item-name">${item.name}</div>
      ${mut ? `<span class="inv-item-mut-label" style="color:${mut.color}">${mut.label}</span>` : ""}
      <span class="inv-item-rarity">${item.rarity.label}</span>`;
    el.addEventListener("click", () => {
      if (key === equippedKey) unequipItem();
      else equipItem(key);
    });
    inventoryGrid.appendChild(el);
  }
}

// ===== AURA SYSTEM =====
function applyAura(rarity, mutation = null) {
  const orbit1 = $("auraOrbit1"), orbit2 = $("auraOrbit2"),
        orbit3 = $("auraOrbit3"), orbit4 = $("auraOrbit4"),
        auraGlow = $("auraGlow"), auraParticles = $("auraParticles");

  if (!rarity || rarity.id === "common" || rarity.id === "uncommon") {
    [orbit1,orbit2,orbit3,orbit4,auraGlow].forEach(el => { el.style.opacity = "0"; el.style.borderColor = "transparent"; el.style.background = "transparent"; });
    auraParticles.innerHTML = "";
    return;
  }

  const color = rarity.color;
  const mutColor = mutation ? mutation.border : null;
  const tier = AURA_TIER[rarity.id] || 1;

  // Glow behind character — blend mutation color in when active
  auraGlow.style.opacity = Math.min(0.9, 0.2 + tier * 0.08).toString();
  auraGlow.style.background = mutColor
    ? `radial-gradient(circle, ${color}55 0%, ${mutColor}44 45%, transparent 70%)`
    : `radial-gradient(circle, ${color}55 0%, transparent 70%)`;
  auraGlow.style.filter = `blur(${8 + tier * 4}px)`;
  auraGlow.style.width = `${140 + tier * 20}px`;
  auraGlow.style.height = `${180 + tier * 20}px`;

  // Configure rings based on tier
  const rings = [orbit1, orbit2, orbit3, orbit4];
  const ringConfig = [
    { show: tier >= 1, opacity: 0.8, glow: 8,  thick: "2px" },
    { show: tier >= 2, opacity: 0.6, glow: 12, thick: "2px" },
    { show: tier >= 4, opacity: 0.5, glow: 16, thick: tier >= 7 ? "3px" : "2px" },
    { show: tier >= 7, opacity: 0.4, glow: 24, thick: "3px" }
  ];

  rings.forEach((ring, i) => {
    const cfg = ringConfig[i];
    if (cfg.show) {
      ring.style.opacity = cfg.opacity.toString();
      // Alternate even rings to mutation color when mutation is active
      const ringColor = (mutColor && i % 2 === 1) ? mutColor : color;
      ring.style.borderColor = ringColor;
      ring.style.borderWidth = cfg.thick;
      ring.style.boxShadow = mutColor
        ? `0 0 ${cfg.glow}px ${ringColor}, 0 0 ${cfg.glow * 1.5}px ${mutColor}55, inset 0 0 ${cfg.glow/2}px ${ringColor}`
        : `0 0 ${cfg.glow}px ${color}, inset 0 0 ${cfg.glow/2}px ${color}`;
    } else {
      ring.style.opacity = "0";
      ring.style.borderColor = "transparent";
    }
  });

  // Remove old mutation-aura style
  const oldMutStyle = document.getElementById("mutation-aura-style");
  if (oldMutStyle) oldMutStyle.remove();

  // Inject pulsing ring animation when mutation is present
  if (mutColor) {
    const ms = document.createElement("style");
    ms.id = "mutation-aura-style";
    ms.textContent = `
      @keyframes mut-ring-pulse {
        0%,100% { box-shadow: 0 0 8px ${color}, 0 0 16px ${mutColor}44, inset 0 0 4px ${color}; }
        50%      { box-shadow: 0 0 20px ${mutColor}, 0 0 32px ${mutColor}88, inset 0 0 12px ${mutColor}; border-color: ${mutColor} !important; }
      }
      #noobScene.mut-aura-active .aura-orbit { animation-name: spin, mut-ring-pulse !important; animation-duration: 4s, 1.8s !important; animation-timing-function: linear, ease-in-out !important; animation-iteration-count: infinite, infinite !important; }
    `;
    document.head.appendChild(ms);
    document.getElementById("noobScene")?.classList.add("mut-aura-active");
  } else {
    document.getElementById("noobScene")?.classList.remove("mut-aura-active");
  }

  // Particle effects for tier 5+
  auraParticles.innerHTML = "";
  if (tier >= 5) {
    const count = Math.min(12, tier * 2);
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      const radius = 80 + tier * 8;
      const size = 3 + tier;
      // Alternate particle color between rarity and mutation
      const pColor = (mutColor && i % 3 === 2) ? mutColor : color;
      p.style.cssText = `
        position: absolute;
        top: 50%; left: 50%;
        width: ${size}px; height: ${size}px;
        background: ${pColor};
        border-radius: 50%;
        box-shadow: 0 0 ${size * 2}px ${pColor}${mutColor && i % 3 === 2 ? ", 0 0 " + (size*4) + "px " + mutColor : ""};
        transform-origin: ${-radius}px 0;
        animation: orbit-particle ${(2 + i * 0.3).toFixed(1)}s linear infinite;
        margin: ${-size/2}px 0 0 ${-size/2}px;
        animation-delay: ${(i * 0.15).toFixed(2)}s;
      `;
      auraParticles.appendChild(p);
    }
    if (!document.getElementById("particle-style")) {
      const style = document.createElement("style");
      style.id = "particle-style";
      style.textContent = `@keyframes orbit-particle { from{transform:rotate(0deg) translateX(var(--r, 90px))} to{transform:rotate(360deg) translateX(var(--r, 90px))} }`;
      document.head.appendChild(style);
    }
  }

  // Beyond: rainbow color cycling
  if (rarity.id === "beyond") {
    if (!document.getElementById("beyond-style")) {
      const style = document.createElement("style");
      style.id = "beyond-style";
      style.textContent = `
        @keyframes rainbow { 0%{border-color:#ff0000;box-shadow:0 0 20px #ff0000,inset 0 0 10px #ff0000} 16%{border-color:#ff7700;box-shadow:0 0 20px #ff7700,inset 0 0 10px #ff7700} 33%{border-color:#ffff00;box-shadow:0 0 20px #ffff00,inset 0 0 10px #ffff00} 50%{border-color:#00ff00;box-shadow:0 0 20px #00ff00,inset 0 0 10px #00ff00} 66%{border-color:#0088ff;box-shadow:0 0 20px #0088ff,inset 0 0 10px #0088ff} 83%{border-color:#ff00ff;box-shadow:0 0 20px #ff00ff,inset 0 0 10px #ff00ff} 100%{border-color:#ff0000;box-shadow:0 0 20px #ff0000,inset 0 0 10px #ff0000} }
        .aura-orbit.orbit-1, .aura-orbit.orbit-2, .aura-orbit.orbit-3, .aura-orbit.orbit-4 { animation-name: spin, rainbow; animation-duration: 4s, 3s; animation-timing-function: linear, linear; animation-iteration-count: infinite, infinite; }
      `;
      document.head.appendChild(style);
    }
  } else {
    // Remove beyond style if switching away
    const bs = document.getElementById("beyond-style");
    if (bs) bs.remove();
  }

  // Apply mutation visual class to the noob scene
  const scene = document.getElementById("noobScene");
  if (scene) {
    scene.className = "noob-scene" + (mutation ? ` mut-${mutation.id}` : "");
  }
}

// ===== EVENTS =====
function scheduleNextEvent() {
  setTimeout(() => {
    if (!activeEvent) {
      const e = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      if (e.id !== "meteor") startEvent(e); // meteor only from admin
    }
    scheduleNextEvent();
  }, 600000); // every 10 minutes exactly
}

function startEvent(event) {
  if (activeEvent) endEvent();
  if (event.effect === "meteor_shower") {
    doMeteorShower();
    return;
  }

  const endTime = Date.now() + event.duration;
  activeEvent = { event, endTime };

  // Show banner
  eventBanner.classList.remove("hidden");
  eventBanner.style.setProperty("--event-color", event.color);
  eventIconWrap.textContent = event.icon;
  eventName.textContent = event.name;
  eventDesc.textContent = event.desc;

  // Countdown
  const tick = setInterval(() => {
    const remaining = Math.ceil((endTime - Date.now()) / 1000);
    if (remaining <= 0) {
      clearInterval(tick);
      endEvent();
    } else {
      eventTimer.textContent = remaining;
    }
  }, 500);

  activeEvent.timerId = tick;
}

function endEvent() {
  if (!activeEvent) return;
  clearInterval(activeEvent.timerId);
  activeEvent = null;
  eventBanner.classList.add("hidden");
}

function doMeteorShower() {
  eventBanner.classList.remove("hidden");
  eventBanner.style.setProperty("--event-color", "#4da8ff");
  eventIconWrap.textContent = "☄️";
  eventName.textContent = "Meteor Shower!";
  eventDesc.textContent = "5 free items raining down!";
  eventTimer.textContent = "5";

  let count = 0;
  const interval = setInterval(() => {
    const rarity = rollRarityResult();
    const item = pickItem(rarity);
    addToInventory(rarity, item);
    count++;
    eventTimer.textContent = (5 - count).toString();
    if (count >= 5) {
      clearInterval(interval);
      setTimeout(() => eventBanner.classList.add("hidden"), 1500);
    }
  }, 700);
}

// ===== ADMIN PANEL =====
function buildAdminSelect() {
  giveRaritySelect.innerHTML = "";
  for (const r of RARITIES) {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = `${r.icon} ${r.label} (1 in ${r.oneIn})`;
    giveRaritySelect.appendChild(opt);
  }
  giveRaritySelect.value = "legendary";

  giveMutationSelect.innerHTML = '<option value="none">🚫 No Mutation</option>';
  for (const m of MUTATIONS) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.icon} ${m.label} · 1 in ${m.oneIn}`;
    giveMutationSelect.appendChild(opt);
  }
  giveMutationSelect.value = "none";
}

function buildEventSelect() {
  eventSelect.innerHTML = "";
  for (const e of EVENTS) {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = `${e.icon} ${e.name}`;
    eventSelect.appendChild(opt);
  }
}

function openAdmin() {
  adminModal.classList.remove("hidden");
  if (!adminUnlocked) {
    adminLock.classList.remove("hidden");
    adminTools.classList.add("hidden");
    adminPasscode.value = "";
    adminError.textContent = "";
    setTimeout(() => adminPasscode.focus(), 100);
  } else {
    adminLock.classList.add("hidden");
    adminTools.classList.remove("hidden");
  }
}

function closeAdmin() { adminModal.classList.add("hidden"); }

function submitPasscode() {
  if (adminPasscode.value === "Admin2167") {
    adminUnlocked = true;
    adminLock.classList.add("hidden");
    adminTools.classList.remove("hidden");
    adminError.textContent = "";
  } else {
    adminError.textContent = "✗ Incorrect passcode.";
    adminPasscode.value = "";
    adminPasscode.focus();
    adminPasscode.style.borderColor = "#ff5f87";
    setTimeout(() => { adminPasscode.style.borderColor = ""; }, 1000);
  }
}

function adminGiveItem() {
  const rarityId = giveRaritySelect.value;
  const rarity = RARITIES.find(r => r.id === rarityId);
  if (!rarity) return;
  const mutId = giveMutationSelect.value;
  const mutation = (mutId && mutId !== "none") ? MUTATIONS.find(m => m.id === mutId) || null : null;
  const qty = Math.min(999, Math.max(1, parseInt(giveQty.value) || 1));
  for (let i = 0; i < qty; i++) addToInventory(rarity, pickItem(rarity), mutation);
  const mutLabel = mutation ? ` + ${mutation.icon} ${mutation.label}` : "";
  logAdmin(`Gave ${qty}× ${rarity.icon} ${rarity.label}${mutLabel}`);
}

function updateLuckDisplays() {
  const disp = luckMultiplier % 1 === 0 ? `${luckMultiplier}×` : `${luckMultiplier.toFixed(1)}×`;
  multiplierDisplay.textContent = disp;
  const cur = $("adminLuckCurrent");
  if (cur) cur.textContent = disp;
}

function adminSetMultiplier() {
  const val = parseFloat(luckValueInput.value);
  if (!val || val < 1 || isNaN(val)) { logAdmin("❌ Enter a number ≥ 1."); return; }
  luckMultiplier = val;
  updateLuckDisplays();
  logAdmin(`✅ Luck multiplier set to ${luckMultiplier}×`);
  saveState();
}

function adminAddLuck() {
  const val = parseFloat($("addLuckInput").value) || 10;
  luckMultiplier = Math.max(1, luckMultiplier + val);
  updateLuckDisplays();
  logAdmin(`Added ${val}× luck → now ${luckMultiplier}×`);
  saveState();
}

function adminSubLuck() {
  const val = parseFloat($("addLuckInput").value) || 10;
  luckMultiplier = Math.max(1, luckMultiplier - val);
  updateLuckDisplays();
  logAdmin(`Removed ${val}× luck → now ${luckMultiplier}×`);
  saveState();
}

function adminTriggerEvent() {
  const eventId = eventSelect.value;
  const event = EVENTS.find(e => e.id === eventId);
  if (!event) return;
  startEvent(event);
  logAdmin(`Triggered event: ${event.name}`);
}

function adminResetRolls() {
  totalRolls = 0;
  totalRollsEl.textContent = "0";
  logAdmin("Roll count reset.");
  saveState();
}

function adminEndEvent() {
  if (activeEvent) {
    logAdmin(`Ended event: ${activeEvent.event.name}`);
    endEvent();
  } else {
    logAdmin("No active event to end.");
  }
}

function adminResetMultiplier() {
  luckMultiplier = 1;
  if (luckValueInput) luckValueInput.value = "1";
  updateLuckDisplays();
  logAdmin("Multiplier reset to 1×.");
  saveState();
}

function adminResetAll() {
  if (!confirm("Reset ALL inventory, rolls, equipped aura, and multiplier? Cannot be undone.")) return;
  inventory = {};
  equippedKey = null;
  totalRolls = 0;
  luckMultiplier = 1;
  totalRollsEl.textContent = "0";
  multiplierDisplay.textContent = "1×";
  if (luckValueInput) luckValueInput.value = "1";
  lastRollIcon.textContent = "🌟";
  lastRollName.textContent = "???";
  lastRollRarity.textContent = "Roll to discover your fate";
  lastRollRarity.style.color = "";
  applyAura(null);
  updateEquippedUI();
  endEvent();
  saveState();
  renderInventory();
  logAdmin("Everything reset.");
}

function logAdmin(msg) {
  const entry = document.createElement("div");
  entry.className = "admin-log-entry";
  const now = new Date();
  const t = [now.getHours(),now.getMinutes(),now.getSeconds()].map(n => n.toString().padStart(2,"0")).join(":");
  entry.innerHTML = `<span class="log-time">[${t}]</span> ${msg}`;
  adminLog.prepend(entry);
}

// ===== PERSISTENCE =====
function saveState() {
  try {
    localStorage.setItem("diddysrng_state", JSON.stringify({
      inventory: Object.fromEntries(Object.entries(inventory).map(([k,v]) => [k, {
        rarityId: v.rarity.id, name: v.name, count: v.count,
        mutationId: v.mutation ? v.mutation.id : "none"
      }])),
      equippedKey,
      totalRolls,
      luckMultiplier
    }));
  } catch(e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem("diddysrng_state");
    if (!raw) return;
    const data = JSON.parse(raw);
    totalRolls = data.totalRolls || 0;
    totalRollsEl.textContent = totalRolls.toLocaleString();
    luckMultiplier = data.luckMultiplier || 1;
    multiplierDisplay.textContent = `${luckMultiplier}×`;
    if (luckValueInput) luckValueInput.value = luckMultiplier.toString();
    inventory = {};
    for (const [key, val] of Object.entries(data.inventory || {})) {
      const rarity = RARITIES.find(r => r.id === val.rarityId);
      if (!rarity) continue;
      const mutation = (val.mutationId && val.mutationId !== "none")
        ? MUTATIONS.find(m => m.id === val.mutationId) || null
        : null;
      inventory[key] = { rarity, name: val.name, count: val.count, mutation };
    }
    equippedKey = data.equippedKey || null;
    if (equippedKey && !inventory[equippedKey]) equippedKey = null;
  } catch(e) { inventory = {}; totalRolls = 0; }
}

// ===== START =====
init();
checkAuth();
