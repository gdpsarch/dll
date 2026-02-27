const SUPABASE_URL      = "https://kyoyfvgdeabkylhggpto.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DP1Ut2zBTJawMv-m6E-vnQ_MTn5u_ig";

const DISCORD_WEBHOOK_URL = "";
const TELEGRAM_BOT_TOKEN  = "8712706690:AAGauu7o62qSg3ivMwV8X6744txmg9Gum9Y";
const TELEGRAM_CHAT_ID    = "";

let allLevels      = [];
let activeLevelId  = null;
let searchQuery    = "";

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
const detailCreator  = document.getElementById("detailCreator");
const detailVerifier = document.getElementById("detailVerifier");
const detailPublisher= document.getElementById("detailPublisher");
const detailVideo    = document.getElementById("detailVideo");
const showcaseTabBtn = document.getElementById("showcaseTabBtn");
const detailID       = document.getElementById("levelIdValue");
const detailTags     = document.getElementById("detailTags");

function renderSidebar() {
  const q = searchQuery.toLowerCase();
  const filtered = q
    ? allLevels.filter(l => l.name.toLowerCase().includes(q) || l.creator.toLowerCase().includes(q))
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

  detailCreator.textContent  = level.creator;
  detailVerifier.textContent = level.verifier;
  detailPublisher.textContent= level.publisher;
  detailID.textContent = level.level_id;

  detailTags.innerHTML = "";
  if (level.tags) {
    const tagsArray = level.tags.split(",").map(t => t.trim());
    tagsArray.forEach(tag => {
      if (tag === "") return;
      const img = document.createElement("img");
      img.src = `assets/tags/${tag}.png`;
      img.className = "tag-icon";
      img.alt = tag;
      img.onerror = () => img.remove();
      detailTags.appendChild(img);
    });
  }

  const embedUrl = gdEmbed(level.video_url);
  detailVideo.src = embedUrl || "";
  showcaseTabBtn.style.display = "none";

  document.querySelectorAll(".vtab").forEach(t => t.classList.remove("active"));
  document.querySelector(".vtab[data-tab='verification']").classList.add("active");

  mainPlaceholder.classList.add("hidden");
  mainError.classList.add("hidden");
  levelDetail.classList.remove("hidden");

  document.querySelector(".main-content").scrollTop = 0;
}

document.querySelectorAll(".vtab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".vtab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    const level = allLevels.find(l => l.id === activeLevelId);
    if (level) detailVideo.src = gdEmbed(level.video_url) || "";
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

function collectSubmission() {
  const name    = document.getElementById("sub_name").value.trim();
  const levelId = document.getElementById("sub_id").value.trim();
  const creator = document.getElementById("sub_creator").value.trim();
  const video   = document.getElementById("sub_video").value.trim();
  const note    = document.getElementById("submitNote");

  if (!name || !levelId || !creator || !video) {
    setNote(note, "error", "Please fill in all fields."); return null;
  }
  try { new URL(video); } catch { setNote(note, "error", "Enter a valid video URL."); return null; }
  if (!video.includes("youtube") && !video.includes("youtu.be")) {
    setNote(note, "error", "Only YouTube links are accepted."); return null;
  }
  return { name, level_id: levelId, creator, video_url: video };
}

document.getElementById("submitViaDiscord").addEventListener("click", async () => {
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
          { name: "Video", value: data.video_url }
        ], timestamp: new Date().toISOString() }] })
    });
    if (r.ok || r.status === 204) setNote("submitNote", "success", "✓ Sent via Discord!");
    else throw new Error(`Status ${r.status}`);
  } catch(e) { setNote("submitNote", "error", `Discord error: ${e.message}`); }
});

document.getElementById("submitViaTelegram").addEventListener("click", async () => {
  const data = collectSubmission();
  if (!data) return;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) { setNote("submitNote", "error", "Telegram not configured."); return; }
  try {
    const text = `📥 *New Level Submission*\n*Name:* ${data.name}\n*ID:* ${data.level_id}\n*Creator:* ${data.creator}\n*Video:* ${data.video_url}`;
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "Markdown" })
    });
    const j = await r.json();
    if (j.ok) setNote("submitNote", "success", "✓ Sent via Telegram!");
    else throw new Error(j.description);
  } catch(e) { setNote("submitNote", "error", `Telegram error: ${e.message}`); }
});

window._d3n1 = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  sbHeaders,
  fetchLevels,
  setNote,
  reload: async () => {
    allLevels = await fetchLevels();
    statTotal.textContent = allLevels.length;
    statVerif.textContent = new Set(allLevels.map(l => l.verifier)).size;
    renderSidebar();
    return allLevels;
  }
};

async function init() {
  try {
    allLevels = await fetchLevels();
    statTotal.textContent = allLevels.length;
    statVerif.textContent = Math.max(new Set(allLevels.map(l => l.verifier)).size - 1);
    renderSidebar();
    mainPlaceholder.querySelector("p").textContent = "Select a level from the list";
    mainPlaceholder.querySelector(".placeholder-icon").innerHTML =
      `<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="8.01" y2="15"/><line x1="12" y1="15" x2="12.01" y2="15"/><line x1="16" y1="15" x2="16.01" y2="15"/></svg>`;
    if (allLevels.length) selectLevel(allLevels[0].id);
  } catch (err) {
    mainPlaceholder.classList.add("hidden");
    mainError.classList.remove("hidden");
    sidebarList.innerHTML = "";
    errorMsg.textContent = `${err.message} — Check SUPABASE_URL and SUPABASE_ANON_KEY in js/app.js`;
    console.error("[d3n1GDPS]", err);
  }
}
init();