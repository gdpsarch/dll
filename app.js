const SUPABASE_URL      = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

const DISCORD_WEBHOOK_URL = CONFIG.DISCORD_WEBHOOK_URL;
const TELEGRAM_BOT_TOKEN  = CONFIG.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID    = CONFIG.TELEGRAM_CHAT_ID;

const SUBMISSION_COOLDOWN = 60 * 60 * 1000;

let allLevels      = [];
let allRecords     = [];
let activeLevelId  = null;
let searchQuery    = "";

const tagData = {
  "collab": { desc: "Created by multiple creators working together.", color: "#00ffa3" },
  "dual": { desc: "Focuses on dual-mode gameplay and coordination.", color: "#ff0066" },
  "fast": { desc: "High-speed gameplay with rapid movements.", color: "#ffcc00" },
  "flash": { desc: "Contains flashing lights or strobe effects.", color: "#ffff00" },
  "flow": { desc: "Fast-paced gameplay focused on smooth transitions.", color: "#ffffff" },
  "layout": { desc: "Level featuring unpolished or minimal decoration.", color: "#4d4d4d" },
  "long": { desc: "A level with a longer than average duration.", color: "#00ff00" },
  "medium": { desc: "Medium overall difficulty and length.", color: "#a6a6a6" },
  "memory": { desc: "Requires memorization of hidden or tricky paths.", color: "#6633ff" },
  "nerfed": { desc: "A version of a level that has been made easier.", color: "#00cc66" },
  "silent": { desc: "Extremely difficult, often considered impossible.", color: "#1a0033" },
  "spammy": { desc: "Requires extremely fast clicking or jitter clicking.", color: "#ff00ff" },
  "special": { desc: "Features unique mechanics or special events.", color: "#ffffff" },
  "sync": { desc: "Gameplay is strictly synchronized to the music.", color: "#00ccff" },
  "timing": { desc: "Requires highly precise and timed inputs.", color: "#ff4d4d" },
  "unique": { desc: "Features original or never-before-seen gameplay.", color: "#00ffd4" },
  "wave": { desc: "Gameplay heavily focused on the Wave mode.", color: "#0099ff" },
  "xl": { desc: "Extra long level, typically over 2 minutes.", color: "#ff9900" },
  "xl+": { desc: "Extremely long level (Marathon length).", color: "#ff3300" }
};

function sbHeaders() {
  return {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  };
}

async function fetchLevels() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/levels?select=*&order=position.asc`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

async function fetchRecords() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/records?select=*&order=date.asc`, { headers: sbHeaders() });
    if (!r.ok) return [];
    return r.json();
  } catch (e) {
    return [];
  }
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

function gdEmbed(url) {
  if (!url) return null;
  const m = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
  if (m) {
    const vid = m[1];
    return `https://drive.google.com/file/d/${vid}/preview`;
  }
  return null;
}

function setNote(el, type, text) {
  if (typeof el === "string") el = document.getElementById(el);
  el.className = `form-note ${type}`;
  el.textContent = text;
}

const sidebarList    = document.getElementById("sidebarList");
const mainPlaceholder= document.getElementById("mainPlaceholder");
const mainError      = document.getElementById("mainError");
const levelDetail    = document.getElementById("levelDetail");
const errorMsg       = document.getElementById("errorMsg");
const searchInput    = document.getElementById("searchInput");
const statTotal      = document.getElementById("statTotal");
const statVerif      = document.getElementById("statVerif");

const detailDiffImg  = document.getElementById("detailDiffImg");
const detailName     = document.getElementById("detailName");
const detailVerified = document.getElementById("detailVerified");
const detailCreator  = document.getElementById("detailCreator");
const detailVerifier = document.getElementById("detailVerifier");
const detailPublisher= document.getElementById("detailPublisher");
const detailVideo    = document.getElementById("detailVideo");
const showcaseTabBtn = document.getElementById("showcaseTabBtn");
const detailID       = document.getElementById("levelIdValue");
const detailPoints   = document.getElementById("detailPoints");
const detailLength   = document.getElementById("detailLength");
const detailObjects  = document.getElementById("detailObjects");
const detailObjBar   = document.getElementById("detailObjBar");
const detailTags     = document.getElementById("detailTags");

const videoWrapper   = document.getElementById("videoWrapper");
const recordsWrapper = document.getElementById("recordsWrapper");
const recordsList    = document.getElementById("recordsList");
const noRecordsMsg   = document.getElementById("noRecordsMsg");

function renderSidebar() {
  const q = searchQuery.toLowerCase();
  const filtered = q
    ? allLevels.filter(l => 
        (l.name && l.name.toLowerCase().includes(q)) || 
        (l.creator && l.creator.toLowerCase().includes(q)) ||
        (l.tags && l.tags.toLowerCase().includes(q))
      )
    : allLevels;

  if (!filtered.length) {
    sidebarList.innerHTML = `<div style="padding:1rem .8rem;font-size:.85rem;color:var(--text-dim)">No levels found.</div>`;
    return;
  }

  sidebarList.innerHTML = filtered.map(l => `
    <div class="sidebar-item${l.id == activeLevelId ? " active" : ""}"
         data-id="${esc(l.id)}" data-lvl="${esc(l.position)}">
      <span class="item-rank">#${esc(l.position)}</span>
      <span class="item-name">${esc(l.name)}</span>
    </div>
  `).join("");

  sidebarList.querySelectorAll(".sidebar-item").forEach(el => {
    el.addEventListener("click", () => selectLevel(parseInt(el.dataset.id, 10)));
  });
}

function selectLevel(id) {
  const level = allLevels.find(l => l.id === id);
  if (!level) return;

  activeLevelId = id;
  renderSidebar();

  const diffSlug = level.difficulty_icon || "extreme_demon";
  detailDiffImg.src = `assets/difficulty/${diffSlug}.png`;
  detailDiffImg.alt = diffSlug.replace(/_/g, " ");
  detailDiffImg.style.visibility = "visible";
  detailName.textContent = level.name;

  if (level.is_verified) {
    detailVerified.classList.remove("hidden");
  } else {
    detailVerified.classList.add("hidden");
  }

  detailCreator.textContent  = level.creator || "Unknown";
  detailVerifier.textContent = level.verifier || "None";
  detailPublisher.textContent= level.publisher || "None";
  detailID.textContent = level.level_id || "N/A";
  
  detailPoints.textContent = level.points || "0";
  detailLength.textContent = level.length || "Unknown";

  const objCount = level.objects || 0;
  detailObjects.textContent = objCount.toLocaleString();
  
  const maxObj = 100000;
  let pct = Math.min((objCount / maxObj) * 100, 100);
  detailObjBar.style.width = pct + "%";
  detailObjBar.className = "obj-bar-fill";
  if (objCount < 40000) detailObjBar.classList.add("obj-low");
  else if (objCount < 80000) detailObjBar.classList.add("obj-med");
  else detailObjBar.classList.add("obj-high");

  detailTags.innerHTML = "";
  if (level.tags) {
    const tagsArray = level.tags.split(",").map(t => t.trim()).filter(Boolean);
    tagsArray.forEach(tag => {
      const tagInfo = tagData[tag] || { desc: "No description provided.", color: "#ffffff" };
      const wrapper = document.createElement("div");
      wrapper.className = "tag-wrapper";
      wrapper.style.setProperty("--tag-color", tagInfo.color);
      
      const img = document.createElement("img");
      img.src = `assets/tags/${tag}.png`;
      img.className = "tag-icon";
      img.alt = tag;
      img.onerror = () => wrapper.remove();
      
      const tooltip = document.createElement("div");
      tooltip.className = "tag-tooltip";
      const descText = document.createElement("span");
      descText.textContent = tagInfo.desc;
      tooltip.appendChild(descText);
      
      if (tag.toLowerCase() === "sync") {
        const catImg = document.createElement("img");
        catImg.src = "assets/easteregg/soggycat.webp";
        catImg.className = "soggy-cat";
        tooltip.appendChild(catImg);
      }
      
      wrapper.appendChild(img);
      wrapper.appendChild(tooltip);
      detailTags.appendChild(wrapper);
    });
  }

  const embedUrl = gdEmbed(level.video_url);
  detailVideo.src = embedUrl || "";
  showcaseTabBtn.style.display = "none";

  const lvlRecords = allRecords.filter(r => r.row_id === id);
  recordsList.innerHTML = "";
  if (lvlRecords.length > 0) {
    noRecordsMsg.classList.add("hidden");
    recordsList.innerHTML = lvlRecords.map(r => `
      <tr>
        <td>${esc(r.player)}</td>
        <td>${esc(r.date || "Unknown")}</td>
      </tr>
    `).join("");
  } else {
    noRecordsMsg.classList.remove("hidden");
  }

  document.querySelectorAll(".vtab").forEach(t => t.classList.remove("active"));
  document.querySelector(".vtab[data-tab='verification']").classList.add("active");
  videoWrapper.classList.remove("hidden");
  recordsWrapper.classList.add("hidden");

  mainPlaceholder.classList.add("hidden");
  mainError.classList.add("hidden");
  levelDetail.classList.remove("hidden");

  document.querySelector(".main-content").scrollTop = 0;
}

detailID.addEventListener("click", () => {
  const idText = detailID.textContent;
  if (idText === "N/A" || idText === "—") return;
  navigator.clipboard.writeText(idText);
  
  const origText = detailID.textContent;
  detailID.textContent = "Copied!";
  detailID.classList.add("copied");
  
  setTimeout(() => {
    detailID.textContent = origText;
    detailID.classList.remove("copied");
  }, 1500);
});

document.querySelectorAll(".vtab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".vtab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    
    if (btn.dataset.tab === "verification" || btn.dataset.tab === "showcase") {
      videoWrapper.classList.remove("hidden");
      recordsWrapper.classList.add("hidden");
      const level = allLevels.find(l => l.id === activeLevelId);
      if (level) detailVideo.src = gdEmbed(level.video_url) || "";
    } else if (btn.dataset.tab === "records") {
      videoWrapper.classList.add("hidden");
      recordsWrapper.classList.remove("hidden");
      detailVideo.src = "";
    }
  });
});

searchInput.addEventListener("input", e => {
  searchQuery = e.target.value.trim();
  renderSidebar();
});

(function initTheme() {
  const saved   = localStorage.getItem("d3n1-theme");
  const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", saved || (sysDark ? "dark" : "light"));
})();

document.getElementById("themeToggle").addEventListener("click", () => {
  const curr = document.documentElement.getAttribute("data-theme");
  const next = curr === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("d3n1-theme", next);
});

const submitModal = document.getElementById("submitModal");
document.getElementById("submitBtn").addEventListener("click", () => submitModal.classList.remove("hidden"));
document.getElementById("submitModalClose").addEventListener("click", () => submitModal.classList.add("hidden"));
submitModal.addEventListener("click", e => { if (e.target === submitModal) submitModal.classList.add("hidden"); });

const submitRecordModal = document.getElementById("submitRecordModal");
document.getElementById("submitRecordBtn").addEventListener("click", () => {
  if (activeLevelId) {
    const level = allLevels.find(l => l.id === activeLevelId);
    if (level) {
      document.getElementById("rec_level").value = `${level.name} (${level.level_id})`;
    }
  }
  submitRecordModal.classList.remove("hidden");
});
document.getElementById("submitRecordModalClose").addEventListener("click", () => submitRecordModal.classList.add("hidden"));
submitRecordModal.addEventListener("click", e => { if (e.target === submitRecordModal) submitRecordModal.classList.add("hidden"); });

async function getClientIp() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (e) {
    return "unknown_ip";
  }
}

async function checkCooldown(noteId) {
  const ip = await getClientIp();
  const lastSub = localStorage.getItem(`last_sub_${ip}`);
  const now = Date.now();

  if (lastSub && (now - parseInt(lastSub)) < SUBMISSION_COOLDOWN) {
    const remaining = Math.ceil((SUBMISSION_COOLDOWN - (now - parseInt(lastSub))) / 60000);
    setNote(noteId, "error", `Cooldown active. Please wait ${remaining} minutes.`);
    return null;
  }
  return ip;
}

function updateCooldown(ip) {
  localStorage.setItem(`last_sub_${ip}`, Date.now().toString());
}

function collectSubmission() {
  const name    = document.getElementById("sub_name").value.trim();
  const levelId = document.getElementById("sub_id").value.trim();
  const creator = document.getElementById("sub_creator").value.trim();
  const note    = document.getElementById("submitNote");

  if (!name || !levelId || !creator) {
    setNote(note, "error", "Please fill in all fields."); return null;
  }
  return { name, level_id: levelId, creator};
}

function collectRecordSubmission() {
  const player = document.getElementById("rec_player").value.trim();
  const level  = document.getElementById("rec_level").value.trim();
  const video  = document.getElementById("rec_video").value.trim();
  const note   = document.getElementById("submitRecNote");

  if (!player || !level || !video) {
    setNote(note, "error", "Please fill in all fields."); return null;
  }
  return { player, level, video };
}

document.getElementById("submitViaDiscord").addEventListener("click", async () => {
  const ip = await checkCooldown("submitNote");
  if (!ip) return;

  const data = collectSubmission();
  if (!data) return;
  if (!DISCORD_WEBHOOK_URL) { setNote("submitNote", "error", "Discord webhook not configured."); return; }
  
  try {
    const r = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [{ title: "📥 New Level Submission", color: 0x007bff,
        fields: [
          { name: "Level Name", value: data.name, inline: true },
          { name: "Level ID", value: data.level_id, inline: true },
          { name: "Creator", value: data.creator, inline: true },
          { name: "IP Info", value: ip }
        ], timestamp: new Date().toISOString() }] })
    });
    if (r.ok || r.status === 204) {
      setNote("submitNote", "success", "✓ Sent via Discord!");
      updateCooldown(ip);
    }
    else throw new Error(`Status ${r.status}`);
  } catch(e) { setNote("submitNote", "error", `Discord error: ${e.message}`); }
});

document.getElementById("submitViaTelegram").addEventListener("click", async () => {
  const ip = await checkCooldown("submitNote");
  if (!ip) return;

  const data = collectSubmission();
  if (!data) return;
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) { 
    setNote("submitNote", "error", "Telegram not configured."); 
    return; 
  }
  
  try {
    const text = `📥 <b>New Level Submission</b>\n` +
                 `<b>Name:</b> ${data.name}\n` +
                 `<b>ID:</b> ${data.level_id}\n` +
                 `<b>Creator:</b> ${data.creator}\n` +
                 `<b>IP:</b> <tg-spoiler>${ip}</tg-spoiler>`;

    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: TELEGRAM_CHAT_ID, 
        text: text, 
        parse_mode: "HTML"
      })
    });

    const j = await r.json();
    if (j.ok) {
      setNote("submitNote", "success", "✓ Sent via Telegram!");
      updateCooldown(ip);
    } else {
      throw new Error(j.description);
    }
  } catch(e) { 
    setNote("submitNote", "error", `Telegram error: ${e.message}`); 
  }
});

document.getElementById("submitRecViaDiscord").addEventListener("click", async () => {
  const ip = await checkCooldown("submitRecNote");
  if (!ip) return;

  const data = collectRecordSubmission();
  if (!data) return;
  if (!DISCORD_WEBHOOK_URL) { setNote("submitRecNote", "error", "Discord webhook not configured."); return; }
  
  try {
    const r = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [{ title: "🏆 New Record Submission", color: 0x00d68f,
        fields: [
          { name: "Player", value: data.player, inline: true },
          { name: "Level", value: data.level, inline: true },
          { name: "Video URL", value: data.video, inline: false },
          { name: "IP Info", value: ip, inline: false }
        ], timestamp: new Date().toISOString() }] })
    });
    if (r.ok || r.status === 204) {
      setNote("submitRecNote", "success", "✓ Sent via Discord!");
      updateCooldown(ip);
    }
    else throw new Error(`Status ${r.status}`);
  } catch(e) { setNote("submitRecNote", "error", `Discord error: ${e.message}`); }
});

document.getElementById("submitRecViaTelegram").addEventListener("click", async () => {
  const ip = await checkCooldown("submitRecNote");
  if (!ip) return;

  const data = collectRecordSubmission();
  if (!data) return;
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) { 
    setNote("submitRecNote", "error", "Telegram not configured."); 
    return; 
  }
  
  try {
    const text = `🏆 <b>New Record Submission</b>\n` +
                 `<b>Player:</b> ${esc(data.player)}\n` +
                 `<b>Level:</b> ${esc(data.level)}\n` +
                 `<b>Video:</b> ${esc(data.video)}\n` +
                 `<b>IP:</b> <tg-spoiler>${ip}</tg-spoiler>`;

    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: "HTML" })
    });

    const j = await r.json();
    if (j.ok) {
      setNote("submitRecNote", "success", "✓ Sent via Telegram!");
      updateCooldown(ip);
    } else {
      throw new Error(j.description);
    }
  } catch(e) { 
    setNote("submitRecNote", "error", `Telegram error: ${e.message}`); 
  }
});

window._d3n1 = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  sbHeaders,
  fetchLevels,
  setNote,
  reload: async () => {
    const [levelsRes, recordsRes] = await Promise.all([
      fetchLevels(),
      fetchRecords()
    ]);
    allLevels = levelsRes;
    allRecords = recordsRes;
    statTotal.textContent = allLevels.length;
    statVerif.textContent = new Set(allLevels.map(l => l.verifier)).size;
    renderSidebar();
    return allLevels;
  }
};

async function init() {
  try {
    const [levelsRes, recordsRes] = await Promise.all([
      fetchLevels(),
      fetchRecords()
    ]);
    allLevels = levelsRes;
    allRecords = recordsRes;

    statTotal.textContent = allLevels.length;
    statVerif.textContent = Math.max(new Set(allLevels.map(l => l.verifier)).size - 1, 0);
    renderSidebar();
    
    mainPlaceholder.querySelector("p").textContent = "Select a level from the list";
    mainPlaceholder.querySelector(".placeholder-icon").innerHTML =
      `<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="8.01" y2="15"/><line x1="12" y1="15" x2="12.01" y2="15"/><line x1="16" y1="15" x2="16.01" y2="15"/></svg>`;
    
    if (allLevels.length) selectLevel(allLevels[0].id);
  } catch (err) {
    mainPlaceholder.classList.add("hidden");
    mainError.classList.remove("hidden");
    sidebarList.innerHTML = "";
    errorMsg.textContent = `${err.message} — Check SUPABASE_URL and SUPABASE_ANON_KEY in app.js`;
    console.error("[d3n1GDPS]", err);
  }
}

init();