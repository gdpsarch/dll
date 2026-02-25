'use strict';

let levelsData = [];
let filteredData = [];
let activeIndex  = 0;
let activeTab    = 'verification';

(function initTheme() {
  const saved = localStorage.getItem('dll-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

const $ = id => document.getElementById(id);
const searchInput  = $('search-input');
const levelList    = $('level-list');
const detailView   = $('level-detail');
const detailTitle  = $('detail-title');
const detailRank   = $('detail-rank');
const detailIcon   = $('detail-icon');
const detailCreator= $('detail-creator');
const detailVerifier=$('detail-verifier');
const detailPublisher=$('detail-publisher');
const detailLevelId=$('detail-level-id');
const verifyPane   = $('tab-verify');
const verifyFrame  = $('verify-frame');
const showcasePane = $('tab-showcase');
const showcaseFrame= $('showcase-frame');
const themeToggle  = $('theme-toggle');
const submitModal  = $('submit-modal');

document.addEventListener('DOMContentLoaded', async () => {
  await loadLevels();
  attachEventListeners();
});

async function loadLevels() {
  try {
    const cached = localStorage.getItem('dll-levels-override');
    if (cached) {
      levelsData = JSON.parse(cached);
    } else {
      const res = await fetch('levels.json');
      if (!res.ok) throw new Error('Network error');
      levelsData = await res.json();
    }
    filteredData = [...levelsData];
    renderList(filteredData);
    if (filteredData.length) selectLevel(0);
  } catch (err) {
    console.error('[DLL] Failed to load levels:', err);
    levelList.innerHTML = `<div style="padding:20px;color:var(--text-muted);font-size:.82rem">
      Failed to load levels.<br>Make sure levels.json exists in the root folder.</div>`;
  }
}

function renderList(levels) {
  levelList.innerHTML = '';
  if (!levels.length) {
    levelList.innerHTML = `<div style="padding:16px 10px;color:var(--text-muted);font-size:.82rem">No levels found.</div>`;
    return;
  }
  levels.forEach((lvl, i) => {
    const li = document.createElement('div');
    li.className = 'level-item' + (i === activeIndex ? ' selected' : '');
    li.style.animationDelay = `${i * 30}ms`;
    li.dataset.index = i;

    const iconPath = getDifficultyIcon(lvl.difficulty);
    li.innerHTML = `
      <span class="level-rank">#${lvl.id}</span>
      <img class="level-diff-icon" src="${iconPath}" alt="${lvl.difficulty}" onerror="this.src='assets/difficulty/na.svg'">
      <div class="level-item-info">
        <div class="level-name">${escHtml(lvl.name)}</div>
        <div class="level-creator">${escHtml(lvl.creator)}</div>
      </div>`;
    li.addEventListener('click', () => {
      activeIndex = i;
      document.querySelectorAll('.level-item').forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');
      selectLevel(i, levels);
    });
    levelList.appendChild(li);
  });
}

function selectLevel(index, dataset) {
  const levels = dataset || filteredData;
  const lvl = levels[index];
  if (!lvl) return;

  detailView.classList.remove('visible');
  setTimeout(() => {
    detailTitle.textContent   = lvl.name;
    detailRank.textContent    = `Rank #${lvl.id} · Level ID: ${lvl.levelId}`;
    detailIcon.src            = getDifficultyIcon(lvl.difficulty);
    detailIcon.onerror        = () => { detailIcon.src = 'assets/difficulty/na.svg'; };
    detailCreator.textContent = lvl.creator;
    detailVerifier.textContent= lvl.verifier;
    detailPublisher.textContent= lvl.publisher;
    detailLevelId.textContent = lvl.levelId;

    const tagEl = $('detail-diff-tag');
    if (tagEl) {
      tagEl.textContent = formatDifficulty(lvl.difficulty);
    }

    const embedBase = `https://www.youtube.com/embed/${lvl.videoId}?rel=0&modestbranding=1`;
    verifyFrame.src   = embedBase + '&autoplay=0';
    showcaseFrame.src = embedBase + '&autoplay=0';

    detailView.classList.add('visible');
  }, 100);
}

function handleSearch(query) {
  const q = query.toLowerCase().trim();
  filteredData = !q ? [...levelsData]
    : levelsData.filter(l => l.name.toLowerCase().includes(q) || l.creator.toLowerCase().includes(q));
  activeIndex = 0;
  renderList(filteredData);
  if (filteredData.length) selectLevel(0, filteredData);
}

function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('.detail-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.dataset.tab === name);
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('dll-theme', next);
  updateThemeIcon();
}

function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  themeToggle.textContent = isDark ? '☀️' : '🌙';
}

function openSubmitModal() { submitModal.classList.add('open'); }
function closeSubmitModal() { submitModal.classList.remove('open'); }

function attachEventListeners() {
  searchInput?.addEventListener('input', e => handleSearch(e.target.value));

  themeToggle?.addEventListener('click', toggleTheme);
  updateThemeIcon();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('dll-theme')) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      updateThemeIcon();
    }
  });

  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  $('open-submit-btn')?.addEventListener('click', openSubmitModal);
  $('open-submit-btn-header')?.addEventListener('click', openSubmitModal);
  $('modal-close-btn')?.addEventListener('click', closeSubmitModal);
  submitModal?.addEventListener('click', e => {
    if (e.target === submitModal) closeSubmitModal();
  });

  $('submit-form')?.addEventListener('submit', handleSubmit);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeSubmitModal();
    }
  });
}

async function handleSubmit(e) {
  e.preventDefault();
  const btn    = $('submit-form-btn');
  const status = $('form-status');
  btn.disabled = true;
  status.className = 'form-status';
  status.style.display = 'none';

  const payload = {
    name:     $('f-name').value.trim(),
    levelId:  $('f-levelid').value.trim(),
    creator:  $('f-creator').value.trim(),
    videoLink:$('f-video').value.trim(),
    notes:    $('f-notes').value.trim(),
  };

  const sent = await sendToWebhook(payload);
  if (sent) {
    status.textContent = '✅ Submitted successfully! Moderators will review your entry.';
    status.className = 'form-status success';
    e.target.reset();
    setTimeout(closeSubmitModal, 2500);
  } else {
    status.textContent = '❌ Failed to send. Check your connection or try again later.';
    status.className = 'form-status error';
  }
  status.style.display = 'block';
  btn.disabled = false;
}

function getDifficultyIcon(diff) {
  return `assets/difficulty/${diff || 'na'}.svg`;
}

function formatDifficulty(diff) {
  return (diff || 'N/A').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

window.DLL = {
  reload: loadLevels,
  getLevels: () => levelsData,
};
