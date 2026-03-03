'use strict';

const ADMIN_HASH = '1615bb6419bb051d63e6cb9894dd5f99912275516b670757c928916eef21b619';

const ALL_TAGS = [
  'collab','dual','fast','flash','flow','layout','long','medium',
  'memory','nerfed','silent','spammy','special','sync','timing',
  'unique','wave','xl','xl+'
];

let adminAuthed = false;
let adminLevels = [];
let editingId   = null;
let formTags    = [];
let dragSrcIdx  = null;

function getDb() {
  if (!window._d3n1) throw new Error('app.js not loaded yet');
  return { url: window._d3n1.SUPABASE_URL, h: window._d3n1.sbHeaders() };
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function dbRequest(path, method = 'GET', body = null) {
  const { url, h } = getDb();
  const headers = { ...h };
  if (method === 'POST' || method === 'PATCH') headers['Prefer'] = 'return=representation';
  const opts = { method, headers };
  if (body !== null) opts.body = JSON.stringify(body);
  const r = await fetch(`${url}/rest/v1/${path}`, opts);
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  if (method === 'DELETE') return null;
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

async function loadAdminLevels() {
  adminLevels = await dbRequest('levels?select=*&order=position.asc');
  renderAdminList();
  updateAdminCount();
}

function buildPayload(f) {
  const verifier = f.verifier.trim() || '???';
  return {
    position:        parseInt(f.position) || 1,
    level_id:        f.level_id.trim(),
    name:            f.name.trim(),
    difficulty_icon: 'extreme_demon',
    creator:         f.creator.trim(),
    verifier,
    publisher:       f.publisher.trim(),
    video_url:       f.video_url.trim(),
    tags:            f.tags,
    points:          parseFloat(f.points) || 0,
    length:          f.length.trim(),
    objects:         parseInt(f.objects) || 0,
    is_verified:     verifier !== '???'
  };
}

async function adminCreateLevel(f) {
  await dbRequest('levels', 'POST', buildPayload(f));
  await loadAdminLevels();
  if (window._d3n1?.reload) window._d3n1.reload();
  showAdminSt('Level added ✓', 'ok');
}

async function adminUpdateLevel(id, f) {
  await dbRequest(`levels?id=eq.${id}`, 'PATCH', buildPayload(f));
  await loadAdminLevels();
  if (window._d3n1?.reload) window._d3n1.reload();
  showAdminSt('Saved ✓', 'ok');
}

async function adminDeleteLevel(id, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  await dbRequest(`levels?id=eq.${id}`, 'DELETE');
  await loadAdminLevels();
  if (window._d3n1?.reload) window._d3n1.reload();
  showAdminSt('Deleted', 'ok');
}

async function persistPositions() {
  const { url, h } = getDb();
  const headers = { ...h, 'Prefer': 'resolution=merge-duplicates' };
  const rows = adminLevels.map((l, i) => ({ id: l.id, position: i + 1 }));
  await fetch(`${url}/rest/v1/levels`, {
    method: 'POST', headers, body: JSON.stringify(rows)
  });
  adminLevels.forEach((l, i) => { l.position = i + 1; });
  if (window._d3n1?.reload) window._d3n1.reload();
  showAdminSt('Order saved ✓', 'ok');
}

function updateAdminCount() {
  const el = document.getElementById('_adm-count');
  if (el) el.textContent = `${adminLevels.length} levels`;
}

function renderAdminList() {
  const c = document.getElementById('_adm-list');
  if (!c) return;
  updateAdminCount();
  if (!adminLevels.length) {
    c.innerHTML = `<div class="adm-empty"><div class="adm-empty-i">📭</div>No levels yet.</div>`;
    return;
  }
  c.innerHTML = adminLevels.map((l, i) => `
    <div class="adm-card" draggable="true" data-i="${i}" data-id="${l.id}">
      <span class="adm-handle" title="Drag to reorder">⠿</span>
      <span class="adm-r">#${l.position}</span>
      <div class="adm-inf">
        <div class="adm-nm">${escAdm(l.name)}</div>
        <div class="adm-sub">${escAdm(l.creator || '—')} · Verifier: ${escAdm(l.verifier || '???')} · ${escAdm(l.length || '—')}</div>
      </div>
      <span class="adm-pts">${l.points || 0} pts</span>
      ${l.is_verified ? '<span class="adm-vbadge">✓ Verified</span>' : ''}
      <div class="adm-acts">
        <button class="adm-ab" data-i="${i}" data-a="edit" title="Edit">✏️</button>
        <button class="adm-ab del" data-i="${i}" data-a="del" title="Delete">🗑</button>
      </div>
    </div>
  `).join('');

  c.querySelectorAll('.adm-card').forEach(card => {
    const i = parseInt(card.dataset.i);
    card.querySelectorAll('.adm-ab').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        if (b.dataset.a === 'edit') openAdminForm(i);
        else adminDeleteLevel(adminLevels[i].id, adminLevels[i].name);
      });
    });
    card.addEventListener('dragstart', e => {
      dragSrcIdx = i;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); dragSrcIdx = null; });
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', e => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (dragSrcIdx === null || dragSrcIdx === i) return;
      const moved = adminLevels.splice(dragSrcIdx, 1)[0];
      adminLevels.splice(i, 0, moved);
      renderAdminList();
      persistPositions();
    });
  });
}

function escAdm(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

function openAdminForm(idx) {
  editingId = idx !== null ? adminLevels[idx]?.id : null;
  const lvl = idx !== null ? adminLevels[idx] : {};
  formTags = lvl.tags ? lvl.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  const title = document.getElementById('_aff-title');
  if (title) title.textContent = idx !== null ? `Edit — ${lvl.name}` : 'Add New Level';

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  set('_ff-pos',       lvl.position ?? (adminLevels.length + 1));
  set('_ff-lid',       lvl.level_id ?? '');
  set('_ff-name',      lvl.name ?? '');
  set('_ff-creator',   lvl.creator ?? '');
  set('_ff-verifier',  lvl.verifier === '???' ? '' : (lvl.verifier ?? ''));
  set('_ff-publisher', lvl.publisher ?? '');
  set('_ff-vid',       lvl.video_url ?? '');
  set('_ff-points',    lvl.points ?? '');
  set('_ff-length',    lvl.length ?? '');
  set('_ff-objects',   lvl.objects ?? '');

  renderTagPicker();
  updateVerifiedPreview();

  document.getElementById('_adm-form-ov')?.classList.add('open');
  setTimeout(() => document.getElementById('_ff-name')?.focus(), 80);
}

function closeAdminForm() {
  document.getElementById('_adm-form-ov')?.classList.remove('open');
  editingId = null;
  formTags = [];
}

function renderTagPicker() {
  const wrap = document.getElementById('_ff-tags-wrap');
  if (!wrap) return;
  wrap.innerHTML = ALL_TAGS.map(tag => {
    const active = formTags.includes(tag);
    return `<button type="button" class="adm-tag-chip${active ? ' active' : ''}" data-tag="${tag}">${tag}</button>`;
  }).join('');
  wrap.querySelectorAll('.adm-tag-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (formTags.includes(tag)) { formTags = formTags.filter(t => t !== tag); btn.classList.remove('active'); }
      else { formTags.push(tag); btn.classList.add('active'); }
    });
  });
}

function updateVerifiedPreview() {
  const vi = document.getElementById('_ff-verifier');
  const badge = document.getElementById('_ff-verified-preview');
  if (!vi || !badge) return;
  const val = vi.value.trim();
  badge.textContent = val ? '✓ is_verified = true' : '✗ is_verified = false  (verifier = "???")';
  badge.className = `adm-vi-preview ${val ? 'yes' : 'no'}`;
}

async function submitAdminForm() {
  const get = id => document.getElementById(id)?.value ?? '';
  const name = get('_ff-name').trim();
  if (!name) { document.getElementById('_ff-name')?.focus(); showAdminSt('Name is required', 'err'); return; }

  const btn = document.getElementById('_aff-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const fields = {
    position:  get('_ff-pos'),
    level_id:  get('_ff-lid'),
    name,
    creator:   get('_ff-creator'),
    verifier:  get('_ff-verifier'),
    publisher: get('_ff-publisher'),
    video_url: get('_ff-vid'),
    tags:      formTags.join(','),
    points:    get('_ff-points'),
    length:    get('_ff-length'),
    objects:   get('_ff-objects'),
  };

  try {
    if (editingId !== null) await adminUpdateLevel(editingId, fields);
    else await adminCreateLevel(fields);
    closeAdminForm();
  } catch (e) {
    showAdminSt('Error: ' + e.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✓ Save'; }
  }
}

function showAdminSt(msg, type) {
  const el = document.getElementById('_adm-st');
  if (!el) return;
  el.textContent = msg;
  el.className = `adm-st show ${type}`;
  setTimeout(() => { el.className = 'adm-st'; }, 3500);
}

function injectAdminPanel() {
  if (document.getElementById('_adm')) return;

  const style = document.createElement('style');
  style.textContent = `
#_adm{display:none;position:fixed;inset:0;background:rgba(0,0,6,.88);backdrop-filter:blur(16px);z-index:9999;align-items:center;justify-content:center;padding:16px;}
#_adm.open{display:flex;}
@keyframes _admIn{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:none}}
#_adm-pw-wrap{width:100%;max-width:380px;background:var(--bg-card);border:1px solid var(--border);border-radius:20px;box-shadow:0 32px 80px rgba(0,0,0,.7);overflow:hidden;animation:_admIn .26s cubic-bezier(.4,0,.2,1);}
#_adm-pw-top{background:var(--accent);padding:32px 28px 24px;text-align:center;}
.adm-lock-ico{width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 12px;}
#_adm-pw-top h2{font-size:1.1rem;font-weight:800;letter-spacing:2px;color:#fff;margin:0;text-transform:uppercase;}
#_adm-pw-top p{font-size:.73rem;color:rgba(255,255,255,.6);margin-top:5px;letter-spacing:.4px;}
#_adm-pw-body{padding:24px 26px 22px;}
.adm-pw-field{position:relative;}
.adm-pw-field input{width:100%;padding:12px 42px 12px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-size:.9rem;font-family:inherit;outline:none;transition:border .15s;box-sizing:border-box;}
.adm-pw-field input:focus{border-color:var(--accent);}
.adm-pw-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:.88rem;color:var(--text-muted);padding:0;}
#_adm-pw-err{font-size:.74rem;color:#ff4c4c;margin-top:8px;min-height:16px;font-weight:700;}
#_adm-login-btn{width:100%;margin-top:14px;padding:13px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:.94rem;font-weight:800;letter-spacing:1px;cursor:pointer;transition:background .15s,opacity .15s;text-transform:uppercase;}
#_adm-login-btn:hover{background:var(--accent-bright);}
#_adm-login-btn:disabled{opacity:.55;pointer-events:none;}
.adm-cancel-link{display:block;text-align:center;margin-top:12px;font-size:.73rem;color:var(--text-muted);cursor:pointer;letter-spacing:.3px;}
.adm-cancel-link:hover{color:var(--text-primary);}
#_adm-editor{width:100%;max-width:920px;max-height:92vh;background:var(--bg-card);border:1px solid var(--border);border-radius:20px;box-shadow:0 32px 80px rgba(0,0,0,.7);display:flex;flex-direction:column;overflow:hidden;animation:_admIn .26s cubic-bezier(.4,0,.2,1);}
#_adm-editor.hidden{display:none;}
#_adm-head{background:var(--accent);color:#fff;padding:12px 18px;display:flex;align-items:center;gap:12px;flex-shrink:0;}
#_adm-head h2{font-size:.98rem;font-weight:800;letter-spacing:2px;flex:1;text-transform:uppercase;margin:0;}
#_adm-count{font-size:.73rem;font-weight:700;background:rgba(255,255,255,.18);padding:4px 11px;border-radius:20px;white-space:nowrap;}
.adm-st{font-size:.74rem;font-weight:700;padding:4px 12px;border-radius:8px;opacity:0;transition:opacity .3s;white-space:nowrap;}
.adm-st.show{opacity:1;}.adm-st.ok{background:rgba(0,200,100,.14);color:#00c864;}.adm-st.err{background:rgba(255,60,60,.12);color:#ff4c4c;}
#_adm-x{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.18);border:none;color:#fff;cursor:pointer;font-size:.88rem;display:flex;align-items:center;justify-content:center;transition:background .12s;flex-shrink:0;}
#_adm-x:hover{background:rgba(255,255,255,.32);}
#_adm-toolbar{padding:10px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap;}
.ab{padding:7px 15px;border-radius:8px;border:none;font-family:inherit;font-size:.79rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .13s;letter-spacing:.3px;}
.ab-pri{background:var(--accent);color:#fff;}.ab-pri:hover{background:var(--accent-bright);}
.ab-ghost{background:var(--bg-hover);color:var(--text-secondary);border:1px solid var(--border);}.ab-ghost:hover{color:var(--text-primary);}
#_adm-list{overflow-y:auto;flex:1;padding:10px 18px;display:flex;flex-direction:column;gap:5px;}
.adm-card{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-sidebar);border:1px solid var(--border-card);border-radius:10px;cursor:default;transition:border-color .12s,box-shadow .12s;animation:_admIn .17s ease;}
.adm-card:hover{border-color:var(--accent);box-shadow:0 0 0 3px rgba(26,111,255,.12);}
.adm-card.dragging{opacity:.3;}.adm-card.drag-over{border-color:var(--accent);background:var(--bg-active);}
.adm-handle{color:var(--text-muted);cursor:grab;font-size:.86rem;user-select:none;flex-shrink:0;padding:2px 3px;}.adm-handle:active{cursor:grabbing;}
.adm-r{font-family:'Space Mono',monospace;font-size:.78rem;font-weight:700;color:var(--text-muted);min-width:28px;text-align:right;flex-shrink:0;}
.adm-inf{flex:1;min-width:0;}
.adm-nm{font-weight:700;font-size:.83rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.adm-sub{font-size:.7rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}
.adm-pts{font-size:.71rem;font-weight:700;color:var(--accent-bright,#4d8fff);background:rgba(26,111,255,.1);border:1px solid rgba(26,111,255,.18);padding:2px 8px;border-radius:20px;white-space:nowrap;flex-shrink:0;}
.adm-vbadge{font-size:.68rem;font-weight:700;color:#00c864;background:rgba(0,200,100,.1);border:1px solid rgba(0,200,100,.22);padding:2px 7px;border-radius:20px;white-space:nowrap;flex-shrink:0;}
.adm-acts{display:flex;gap:3px;flex-shrink:0;}
.adm-ab{width:28px;height:28px;border-radius:7px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;font-size:.8rem;display:flex;align-items:center;justify-content:center;transition:background .1s,color .1s;}
.adm-ab:hover{background:var(--bg-hover);color:var(--text-primary);}
.adm-ab.del:hover{background:rgba(255,60,60,.1);color:#ff4c4c;}
.adm-empty{text-align:center;padding:56px 20px;color:var(--text-muted);font-size:.86rem;}
.adm-empty-i{font-size:2.2rem;margin-bottom:10px;}
#_adm-form-ov{display:none;position:absolute;inset:0;z-index:10;background:rgba(0,0,0,.44);backdrop-filter:blur(5px);align-items:flex-end;justify-content:center;}
#_adm-form-ov.open{display:flex;}
#_adm-form-box{width:100%;max-width:920px;background:var(--bg-card);border-top:1px solid var(--border);border-radius:20px 20px 0 0;box-shadow:0 -16px 52px rgba(0,0,0,.3);max-height:90vh;overflow-y:auto;animation:_fUp .22s cubic-bezier(.4,0,.2,1);}
@keyframes _fUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
#_aff-head{position:sticky;top:0;z-index:2;background:var(--bg-card);border-bottom:1px solid var(--border);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;}
#_aff-title{font-size:.94rem;font-weight:800;letter-spacing:.5px;color:var(--text-primary);}
#_aff-cls{width:26px;height:26px;border-radius:50%;background:var(--bg-hover);border:none;cursor:pointer;color:var(--text-muted);font-size:.8rem;display:flex;align-items:center;justify-content:center;transition:background .11s;}
#_aff-cls:hover{background:var(--border);color:var(--text-primary);}
.adm-fgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:18px 20px 0;}
.adm-fgrid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:12px 20px 0;}
.adm-fgrid-full{padding:12px 20px 0;}
@media(max-width:640px){.adm-fgrid,.adm-fgrid-3{grid-template-columns:1fr;}}
.adm-fg{display:flex;flex-direction:column;gap:5px;}
.adm-fl{font-size:.68rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);}
.adm-fl small{font-size:.62rem;text-transform:none;letter-spacing:0;font-weight:400;}
.adm-fi{padding:10px 11px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-family:inherit;font-size:.86rem;outline:none;transition:border .13s;width:100%;box-sizing:border-box;}
.adm-fi:focus{border-color:var(--accent);}
.adm-fi::placeholder{color:var(--text-muted);}
.adm-vi-preview{font-size:.71rem;font-weight:700;padding:3px 8px;border-radius:6px;display:inline-block;margin-top:4px;}
.adm-vi-preview.yes{color:#00c864;background:rgba(0,200,100,.1);}
.adm-vi-preview.no{color:#ff8c42;background:rgba(255,140,66,.1);}
.adm-tags-section{padding:14px 20px 0;}
.adm-tags-label{font-size:.68rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;}
#_ff-tags-wrap{display:flex;flex-wrap:wrap;gap:6px;}
.adm-tag-chip{padding:5px 12px;border-radius:20px;border:1.5px solid var(--border);background:var(--bg-hover);color:var(--text-muted);font-family:inherit;font-size:.73rem;font-weight:700;cursor:pointer;transition:all .12s;letter-spacing:.3px;}
.adm-tag-chip:hover{border-color:var(--accent);color:var(--text-primary);}
.adm-tag-chip.active{background:var(--accent);border-color:var(--accent);color:#fff;box-shadow:0 0 0 2px rgba(26,111,255,.25);}
#_aff-foot{position:sticky;bottom:0;z-index:2;background:var(--bg-card);border-top:1px solid var(--border);padding:13px 20px;display:flex;gap:10px;justify-content:flex-end;}
#_aff-save-btn{padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:.86rem;font-weight:800;cursor:pointer;transition:background .13s,opacity .13s;letter-spacing:.5px;}
#_aff-save-btn:hover{background:var(--accent-bright);}
#_aff-save-btn:disabled{opacity:.55;pointer-events:none;}
#_aff-cancel-btn{padding:10px 20px;background:var(--bg-hover);color:var(--text-secondary);border:1px solid var(--border);border-radius:9px;font-family:inherit;font-size:.86rem;font-weight:700;cursor:pointer;transition:background .12s;}
#_aff-cancel-btn:hover{background:var(--bg-active);}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = '_adm';
  overlay.innerHTML = `
    <div id="_adm-pw-wrap">
      <div id="_adm-pw-top">
        <div class="adm-lock-ico">🔐</div>
        <h2>Admin Panel</h2>
        <p>D3N1GDPS List Editor</p>
      </div>
      <div id="_adm-pw-body">
        <div class="adm-pw-field">
          <input type="password" id="_adm-pi" placeholder="Enter admin password" autocomplete="off" />
          <button class="adm-pw-eye" id="_adm-pw-eye" tabindex="-1">👁</button>
        </div>
        <div id="_adm-pw-err"></div>
        <button id="_adm-login-btn">Unlock →</button>
        <span class="adm-cancel-link" id="_adm-pw-cancel">Cancel</span>
      </div>
    </div>

    <div id="_adm-editor" class="hidden">
      <div id="_adm-head">
        <h2>🛠 List Editor</h2>
        <span id="_adm-count">— levels</span>
        <span id="_adm-st" class="adm-st"></span>
        <button id="_adm-x">✕</button>
      </div>
      <div id="_adm-toolbar">
        <button class="ab ab-pri" id="_adm-add-btn">＋ Add Level</button>
        <button class="ab ab-ghost" id="_adm-reload-btn">↺ Reload</button>
      </div>
      <div id="_adm-list"></div>

      <div id="_adm-form-ov">
        <div id="_adm-form-box">
          <div id="_aff-head">
            <span id="_aff-title">Add New Level</span>
            <button id="_aff-cls">✕</button>
          </div>

          <div class="adm-fgrid">
            <div class="adm-fg">
              <label class="adm-fl">Position</label>
              <input class="adm-fi" type="number" id="_ff-pos" placeholder="1" min="1" />
            </div>
            <div class="adm-fg">
              <label class="adm-fl">Level ID</label>
              <input class="adm-fi" type="text" id="_ff-lid" placeholder="GD level ID" />
            </div>
            <div class="adm-fg">
              <label class="adm-fl">Name <span style="color:#ff5555">*</span></label>
              <input class="adm-fi" type="text" id="_ff-name" placeholder="Level name" />
            </div>
          </div>

          <div class="adm-fgrid">
            <div class="adm-fg">
              <label class="adm-fl">Creator</label>
              <input class="adm-fi" type="text" id="_ff-creator" placeholder="Creator name" />
            </div>
            <div class="adm-fg">
              <label class="adm-fl">Verifier <small>(empty → "???" + unverified)</small></label>
              <input class="adm-fi" type="text" id="_ff-verifier" placeholder="Verifier name" />
              <span id="_ff-verified-preview" class="adm-vi-preview no">✗ is_verified = false</span>
            </div>
            <div class="adm-fg">
              <label class="adm-fl">Publisher</label>
              <input class="adm-fi" type="text" id="_ff-publisher" placeholder="Publisher name" />
            </div>
          </div>

          <div class="adm-fgrid-full">
            <div class="adm-fg">
              <label class="adm-fl">Video URL <small>(YouTube / Google Drive)</small></label>
              <input class="adm-fi" type="url" id="_ff-vid" placeholder="https://..." />
            </div>
          </div>

          <div class="adm-fgrid-3">
            <div class="adm-fg">
              <label class="adm-fl">Points</label>
              <input class="adm-fi" type="number" id="_ff-points" placeholder="e.g. 250" step="0.1" />
            </div>
            <div class="adm-fg">
              <label class="adm-fl">Length <small>e.g. 1m 14s</small></label>
              <input class="adm-fi" type="text" id="_ff-length" placeholder="1m 14s" />
            </div>
            <div class="adm-fg">
              <label class="adm-fl">Objects</label>
              <input class="adm-fi" type="number" id="_ff-objects" placeholder="e.g. 45000" />
            </div>
          </div>

          <div class="adm-tags-section">
            <div class="adm-tags-label">Tags — click to toggle</div>
            <div id="_ff-tags-wrap"></div>
          </div>

          <div style="height:8px"></div>

          <div id="_aff-foot">
            <button id="_aff-cancel-btn">Cancel</button>
            <button id="_aff-save-btn">✓ Save</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('_adm-pw-eye').addEventListener('click', () => {
    const inp = document.getElementById('_adm-pi');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('_adm-pi').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('_adm-login-btn').click();
    document.getElementById('_adm-pw-err').textContent = '';
  });
  document.getElementById('_adm-login-btn').addEventListener('click', async () => {
    const btn = document.getElementById('_adm-login-btn');
    const pw  = document.getElementById('_adm-pi').value;
    const err = document.getElementById('_adm-pw-err');
    btn.disabled = true; btn.textContent = '…';
    const hash = await sha256(pw);
    if (hash === ADMIN_HASH) {
      adminAuthed = true;
      document.getElementById('_adm-pw-wrap').style.display = 'none';
      document.getElementById('_adm-editor').classList.remove('hidden');
      loadAdminLevels();
    } else {
      err.textContent = '✗ Wrong password';
      document.getElementById('_adm-pi').value = '';
      document.getElementById('_adm-pi').focus();
      btn.disabled = false; btn.textContent = 'Unlock →';
    }
  });
  document.getElementById('_adm-pw-cancel').addEventListener('click', closeAdminPanel);
  document.getElementById('_adm-x').addEventListener('click', closeAdminPanel);
  document.getElementById('_adm-add-btn').addEventListener('click', () => openAdminForm(null));
  document.getElementById('_adm-reload-btn').addEventListener('click', loadAdminLevels);
  document.getElementById('_aff-cls').addEventListener('click', closeAdminForm);
  document.getElementById('_aff-cancel-btn').addEventListener('click', closeAdminForm);
  document.getElementById('_aff-save-btn').addEventListener('click', submitAdminForm);
  document.getElementById('_ff-verifier').addEventListener('input', updateVerifiedPreview);
  document.getElementById('_adm').addEventListener('click', e => {
    if (e.target === document.getElementById('_adm')) closeAdminPanel();
  });
  document.getElementById('_adm-form-ov').addEventListener('click', e => {
    if (e.target === document.getElementById('_adm-form-ov')) closeAdminForm();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.getElementById('_adm-form-ov')?.classList.contains('open')) closeAdminForm();
      else closeAdminPanel();
    }
  });
}

function openAdminPanel() {
  injectAdminPanel();
  document.getElementById('_adm').classList.add('open');
  if (!adminAuthed) {
    setTimeout(() => document.getElementById('_adm-pi')?.focus(), 120);
  } else {
    document.getElementById('_adm-pw-wrap').style.display = 'none';
    document.getElementById('_adm-editor').classList.remove('hidden');
    loadAdminLevels();
  }
}

function closeAdminPanel() {
  document.getElementById('_adm')?.classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key === 'S') {
    e.preventDefault();
    openAdminPanel();
  }
});