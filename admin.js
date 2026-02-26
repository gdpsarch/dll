'use strict';

const WEBHOOK_URL = '8712706690:AAFMF8lUIw9Wxkyw96EQu2XwS536VmBGLlg';
const ADMIN_HASH  = '0a79f5a6a5c7b502769ba04b562a8721d57adaa2830a5720323dac07412059ff';

const DIFFICULTIES = [
  'extreme_demon','insane_demon','hard_demon','medium_demon','easy_demon',
  'insane','harder','hard','normal','easy','auto'
];

window.sendToWebhook = async function(payload) {
  if (!WEBHOOK_URL) { console.warn('[DLL] No webhook configured.'); return false; }
  try {
    const isTG = WEBHOOK_URL.includes('api.telegram.org');
    if (isTG) {
      const text = `*New Submission*\n*Name:* ${payload.name}\n*ID:* ${payload.levelId}\n*Creator:* ${payload.creator}\n*Video:* ${payload.videoLink}`;
      const r = await fetch(WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text, parse_mode:'Markdown'}) });
      return r.ok;
    } else {
      const r = await fetch(WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'d3n1GDPS Bot', embeds:[{ title:'New Level Submission', color:0x1a6fff, fields:[ {name:'Level Name',value:payload.name||'—',inline:true},{name:'Level ID',value:payload.levelId||'—',inline:true},{name:'Creator',value:payload.creator||'—',inline:true},{name:'Video',value:payload.videoLink||'—'}, ...(payload.notes?[{name:'Notes',value:payload.notes}]:[]) ], timestamp:new Date().toISOString() }] }) });
      return r.status === 204 || r.ok;
    }
  } catch(e) { console.error('[DLL] Webhook error:', e); return false; }
};

async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

let adminAuthed  = false;
let adminLevels  = [];
let editingIndex = null;

function escHtml(str) {
  const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
}

function injectAdminPanel() {
  if (document.getElementById('_adm')) return;

  const style = document.createElement('style');
  style.textContent = `
#_adm{display:none;position:fixed;inset:0;background:rgba(0,0,6,.85);backdrop-filter:blur(14px);z-index:9999;align-items:center;justify-content:center;padding:16px;}
#_adm.open{display:flex;}
@keyframes _admIn{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:none}}
#_adm-pw-wrap{width:100%;max-width:380px;background:var(--bg-card);border:1px solid var(--border);border-radius:20px;box-shadow:0 32px 80px rgba(0,0,0,.65);overflow:hidden;animation:_admIn .26s cubic-bezier(.4,0,.2,1);}
#_adm-pw-top{background:var(--accent);padding:36px 28px 26px;text-align:center;}
.adm-lock-icon{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:1.55rem;margin:0 auto 14px;}
#_adm-pw-top h2{font-family:'Rajdhani',sans-serif;font-size:1.3rem;font-weight:700;letter-spacing:2px;color:#fff;margin:0;}
#_adm-pw-top p{font-size:.76rem;color:rgba(255,255,255,.6);margin-top:5px;letter-spacing:.5px;}
#_adm-pw-body{padding:26px 28px 24px;}
.adm-field-wrap{position:relative;}
.adm-field-wrap input{width:100%;padding:12px 44px 12px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-size:.92rem;font-family:inherit;outline:none;transition:border .15s;letter-spacing:.04em;}
.adm-field-wrap input:focus{border-color:var(--accent);}
.adm-pw-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:.9rem;color:var(--text-muted);}
#_adm-err{font-size:.75rem;color:#ff4c4c;margin-top:9px;min-height:18px;display:flex;align-items:center;gap:4px;font-weight:600;}
#_adm-login-btn{width:100%;margin-top:14px;padding:13px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-family:'Rajdhani',sans-serif;font-size:1.05rem;font-weight:700;letter-spacing:1.2px;cursor:pointer;transition:background .15s,transform .1s;display:flex;align-items:center;justify-content:center;gap:8px;}
#_adm-login-btn:hover{background:var(--accent-bright);}
#_adm-login-btn:active{transform:scale(.98);}
#_adm-login-btn.loading{opacity:.65;pointer-events:none;}
.adm-cancel{display:block;text-align:center;margin-top:14px;font-size:.75rem;color:var(--text-muted);cursor:pointer;letter-spacing:.3px;}
.adm-cancel:hover{color:var(--text-primary);}
#_adm-editor-wrap{width:100%;max-width:900px;max-height:92vh;background:var(--bg-card);border:1px solid var(--border);border-radius:20px;box-shadow:0 32px 80px rgba(0,0,0,.65);display:flex;flex-direction:column;overflow:hidden;animation:_admIn .26s cubic-bezier(.4,0,.2,1);}
#_adm-head{background:var(--accent);color:#fff;padding:13px 20px;display:flex;align-items:center;gap:14px;flex-shrink:0;}
#_adm-head h2{font-family:'Rajdhani',sans-serif;font-size:1.05rem;font-weight:700;letter-spacing:1.8px;flex:1;}
.adm-tabs{display:flex;background:rgba(255,255,255,.14);border-radius:8px;padding:3px;gap:2px;}
.adm-tabs button{padding:4px 16px;border-radius:6px;border:none;background:transparent;color:rgba(255,255,255,.7);font-family:inherit;font-size:.78rem;font-weight:700;cursor:pointer;transition:all .14s;letter-spacing:.4px;}
.adm-tabs button.active{background:#fff;color:var(--accent);}
#_adm-x{width:29px;height:29px;border-radius:50%;background:rgba(255,255,255,.18);border:none;color:#fff;font-size:.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .14s;flex-shrink:0;}
#_adm-x:hover{background:rgba(255,255,255,.3);}
#_adm-body{flex:1;overflow:hidden;display:flex;flex-direction:column;}
#_adm-vis{display:flex;flex-direction:column;overflow:hidden;flex:1;}
#_adm-vis.hidden,#_adm-json.hidden{display:none;}
.adm-bar{padding:11px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex-shrink:0;}
.adm-bar-l{display:flex;gap:8px;align-items:center;flex:1;}
.adm-bar-r{display:flex;gap:8px;}
.ab{padding:7px 16px;border-radius:8px;border:none;font-family:inherit;font-size:.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .14s;letter-spacing:.3px;}
.ab-pri{background:var(--accent);color:#fff;}.ab-pri:hover{background:var(--accent-bright);}
.ab-suc{background:#00c864;color:#fff;}.ab-suc:hover{background:#00d870;}
.ab-ghost{background:var(--bg-hover);color:var(--text-secondary);border:1px solid var(--border);}.ab-ghost:hover{color:var(--text-primary);background:var(--bg-active);}
.ab-del{background:rgba(255,60,60,.08);color:#ff4c4c;border:1px solid rgba(255,60,60,.22);}.ab-del:hover{background:rgba(255,60,60,.16);}
.adm-cnt{font-size:.77rem;font-weight:700;color:var(--text-muted);background:var(--bg-hover);padding:4px 10px;border-radius:20px;}
.adm-st{font-size:.77rem;font-weight:700;padding:4px 12px;border-radius:8px;opacity:0;transition:opacity .3s;}
.adm-st.show{opacity:1;}.adm-st.ok{background:rgba(0,200,100,.12);color:#00c864;}.adm-st.err{background:rgba(255,60,60,.1);color:#ff4c4c;}
#_adm-list{overflow-y:auto;flex:1;padding:12px 20px;display:flex;flex-direction:column;gap:5px;}
.adm-card{display:flex;align-items:center;gap:11px;padding:10px 13px;background:var(--bg-sidebar);border:1px solid var(--border-card);border-radius:10px;cursor:default;transition:border-color .13s,box-shadow .13s;animation:_admIn .18s ease;}
.adm-card:hover{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow);}
.adm-card.dragging{opacity:.35;}.adm-card.drag-over{border-color:var(--accent);background:var(--bg-active);}
.adm-handle{color:var(--text-muted);cursor:grab;font-size:.88rem;user-select:none;flex-shrink:0;padding:2px 3px;}.adm-handle:active{cursor:grabbing;}
.adm-r{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.82rem;color:var(--text-muted);min-width:26px;text-align:right;}
.adm-ico{width:28px;height:28px;border-radius:6px;object-fit:contain;flex-shrink:0;}
.adm-inf{flex:1;min-width:0;}
.adm-nm{font-weight:700;font-size:.84rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.adm-sub{font-size:.72rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.adm-diff-tag{font-size:.72rem;font-weight:700;color:var(--accent-bright);background:var(--accent-dim);border:1px solid rgba(26,111,255,.2);padding:2px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0;}
.adm-acts{display:flex;gap:3px;flex-shrink:0;}
.adm-ab{width:29px;height:29px;border-radius:7px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;font-size:.82rem;display:flex;align-items:center;justify-content:center;transition:background .11s,color .11s;}
.adm-ab:hover{background:var(--bg-hover);color:var(--text-primary);}
.adm-ab.del:hover{background:rgba(255,60,60,.1);color:#ff4c4c;}
.adm-empty{text-align:center;padding:60px 20px;color:var(--text-muted);font-size:.88rem;}
.adm-empty-i{font-size:2.5rem;margin-bottom:10px;}
#_adm-form-ov{display:none;position:absolute;inset:0;z-index:10;background:rgba(0,0,0,.38);backdrop-filter:blur(4px);align-items:flex-end;justify-content:center;}
#_adm-form-ov.open{display:flex;}
#_adm-form-box{width:100%;max-width:900px;background:var(--bg-card);border-top:1px solid var(--border);border-radius:20px 20px 0 0;box-shadow:0 -14px 48px rgba(0,0,0,.28);animation:_formUp .22s cubic-bezier(.4,0,.2,1);max-height:88vh;overflow-y:auto;}
@keyframes _formUp{from{transform:translateY(36px);opacity:0}to{transform:none;opacity:1}}
#_adm-form-hd{position:sticky;top:0;z-index:1;background:var(--bg-card);border-bottom:1px solid var(--border);padding:15px 22px;display:flex;align-items:center;justify-content:space-between;}
#_adm-form-hd h3{font-family:'Rajdhani',sans-serif;font-size:1rem;font-weight:700;letter-spacing:.8px;color:var(--text-primary);}
#_adm-form-cls{width:26px;height:26px;border-radius:50%;background:var(--bg-hover);border:none;cursor:pointer;color:var(--text-muted);font-size:.82rem;display:flex;align-items:center;justify-content:center;transition:background .12s;}
#_adm-form-cls:hover{background:var(--border);color:var(--text-primary);}
.adm-fgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:20px 22px;}
@media(max-width:560px){.adm-fgrid{grid-template-columns:1fr;}}
.adm-fg{display:flex;flex-direction:column;gap:5px;}.adm-fg.full{grid-column:1/-1;}
.adm-fl{font-size:.71rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);}
.adm-fi,.adm-fs{padding:10px 12px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-family:inherit;font-size:.87rem;outline:none;transition:border .14s;width:100%;appearance:none;}
.adm-fi:focus,.adm-fs:focus{border-color:var(--accent);}
.adm-fi::placeholder{color:var(--text-muted);}
.adm-ffoot{padding:14px 22px;border-top:1px solid var(--border);display:flex;gap:10px;justify-content:flex-end;position:sticky;bottom:0;background:var(--bg-card);z-index:1;}
#_adm-json{display:flex;flex-direction:column;overflow:hidden;flex:1;}
.adm-jtb{padding:10px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-shrink:0;}
.adm-jhint{font-size:.74rem;color:var(--text-muted);flex:1;line-height:1.4;}
#_adm-jta{flex:1;padding:16px 20px;border:none;outline:none;resize:none;background:var(--bg-page);color:var(--text-primary);font-family:'Courier New',monospace;font-size:.78rem;line-height:1.75;}
#_adm-list::-webkit-scrollbar,#_adm-form-box::-webkit-scrollbar,#_adm-jta::-webkit-scrollbar{width:4px;}
#_adm-list::-webkit-scrollbar-thumb,#_adm-form-box::-webkit-scrollbar-thumb,#_adm-jta::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px;}
`;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = '_adm';
  overlay.setAttribute('aria-hidden','true');
  overlay.innerHTML = `
    <div id="_adm-pw-wrap">
      <div id="_adm-pw-top">
        <div class="adm-lock-icon">🔐</div>
        <h2>ADMIN ACCESS</h2>
        <p>d3n1GDPS List Manager</p>
      </div>
      <div id="_adm-pw-body">
        <div class="adm-field-wrap">
          <input type="password" id="_adm-pi" placeholder="Enter admin password" autocomplete="off" spellcheck="false">
          <button class="adm-pw-eye" id="_adm-eye" tabindex="-1">👁</button>
        </div>
        <div id="_adm-err"></div>
        <button id="_adm-login-btn"><span id="_adm-ll">Unlock Panel</span></button>
        <span class="adm-cancel" id="_adm-cancel">Cancel</span>
      </div>
    </div>

    <div id="_adm-editor-wrap" style="display:none">
      <div id="_adm-head">
        <h2>⚙ LIST EDITOR</h2>
        <div class="adm-tabs">
          <button id="_tv" class="active">🗂 Visual</button>
          <button id="_tj">{ } JSON</button>
        </div>
        <button id="_adm-x">✕</button>
      </div>
      <div id="_adm-body">

        <div id="_adm-vis">
          <div class="adm-bar">
            <div class="adm-bar-l">
              <button class="ab ab-pri" id="_adm-add">＋ Add Level</button>
              <span class="adm-cnt" id="_adm-cnt">0 levels</span>
              <span class="adm-st" id="_adm-st"></span>
            </div>
            <div class="adm-bar-r">
              <button class="ab ab-ghost" id="_adm-reload">↺ Reload file</button>
              <button class="ab ab-del"   id="_adm-clrov">🗑 Clear override</button>
              <button class="ab ab-suc"   id="_adm-save">💾 Save &amp; Apply</button>
            </div>
          </div>
          <div id="_adm-list"></div>

          <div id="_adm-form-ov">
            <div id="_adm-form-box">
              <div id="_adm-form-hd">
                <h3 id="_adm-form-title">Add Level</h3>
                <button id="_adm-form-cls">✕</button>
              </div>
              <div class="adm-fgrid">
                <div class="adm-fg"><label class="adm-fl">Rank #</label><input class="adm-fi" id="_ff-rank" type="number" min="1" placeholder="1"></div>
                <div class="adm-fg"><label class="adm-fl">Level ID</label><input class="adm-fi" id="_ff-lid" type="text" placeholder="98765432"></div>
                <div class="adm-fg full"><label class="adm-fl">Level Name</label><input class="adm-fi" id="_ff-name" type="text" placeholder="e.g. Sonic Wave Infinity"></div>
                <div class="adm-fg">
                  <label class="adm-fl">Difficulty</label>
                  <select class="adm-fs" id="_ff-diff">
                    ${DIFFICULTIES.map(d=>`<option value="${d}">${d.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>`).join('')}
                  </select>
                </div>
                <div class="adm-fg"><label class="adm-fl">Creator</label><input class="adm-fi" id="_ff-creator" type="text" placeholder="Creator name"></div>
                <div class="adm-fg"><label class="adm-fl">Verifier</label><input class="adm-fi" id="_ff-verifier" type="text" placeholder="Verifier name"></div>
                <div class="adm-fg"><label class="adm-fl">Publisher</label><input class="adm-fi" id="_ff-publisher" type="text" placeholder="Publisher name"></div>
                <div class="adm-fg full"><label class="adm-fl">YouTube Video ID</label><input class="adm-fi" id="_ff-vid" type="text" placeholder="dQw4w9WgXcQ  (ID after ?v= or youtu.be/)"></div>
              </div>
              <div class="adm-ffoot">
                <button class="ab ab-ghost" id="_ff-cancel">Cancel</button>
                <button class="ab ab-pri"   id="_ff-save">Save Level</button>
              </div>
            </div>
          </div>
        </div>

        <div id="_adm-json" class="hidden">
          <div class="adm-jtb">
            <span class="adm-jhint">Raw JSON — edit then click Apply to sync back to the visual editor.</span>
            <button class="ab ab-ghost" id="_adm-jfmt">✨ Format</button>
            <button class="ab ab-pri"   id="_adm-japply">✓ Apply JSON</button>
          </div>
          <textarea id="_adm-jta" spellcheck="false" placeholder="Loading..."></textarea>
        </div>

      </div>
    </div>`;

  document.body.appendChild(overlay);

  document.getElementById('_adm-pi').addEventListener('keydown', e => { if(e.key==='Enter') attemptLogin(); });
  document.getElementById('_adm-login-btn').addEventListener('click', attemptLogin);
  document.getElementById('_adm-cancel').addEventListener('click', closeAdmin);
  document.getElementById('_adm-eye').addEventListener('click', () => {
    const i = document.getElementById('_adm-pi'); i.type = i.type==='password'?'text':'password';
  });
  document.getElementById('_adm-x').addEventListener('click', closeAdmin);
  overlay.addEventListener('click', e => { if(e.target===overlay) closeAdmin(); });

  document.getElementById('_tv').addEventListener('click', () => switchTab('vis'));
  document.getElementById('_tj').addEventListener('click', () => { syncJson(); switchTab('json'); });

  document.getElementById('_adm-add').addEventListener('click',    () => openForm(null));
  document.getElementById('_adm-save').addEventListener('click',   saveApply);
  document.getElementById('_adm-reload').addEventListener('click', reloadFile);
  document.getElementById('_adm-clrov').addEventListener('click', clearOverride);

  document.getElementById('_adm-form-cls').addEventListener('click', closeForm);
  document.getElementById('_ff-cancel').addEventListener('click',    closeForm);
  document.getElementById('_ff-save').addEventListener('click',      submitForm);
  document.getElementById('_adm-form-ov').addEventListener('click', e => {
    if(e.target===document.getElementById('_adm-form-ov')) closeForm();
  });

  document.getElementById('_adm-jfmt').addEventListener('click',   fmtJson);
  document.getElementById('_adm-japply').addEventListener('click', applyJson);
}

async function attemptLogin() {
  const input = document.getElementById('_adm-pi');
  const btn   = document.getElementById('_adm-login-btn');
  const err   = document.getElementById('_adm-err');
  btn.classList.add('loading');
  document.getElementById('_adm-ll').textContent = 'Verifying...';
  err.textContent = '';
  await new Promise(r=>setTimeout(r,380));
  const h = await sha256(input.value);
  if (h === ADMIN_HASH) {
    adminAuthed = true;
    input.value = '';
    document.getElementById('_adm-pw-wrap').style.display = 'none';
    document.getElementById('_adm-editor-wrap').style.display = '';
    await loadEditor();
  } else {
    err.textContent = '✖ Incorrect password. Try again.';
    input.value = ''; input.focus();
  }
  btn.classList.remove('loading');
  document.getElementById('_adm-ll').textContent = 'Unlock Panel';
}

async function loadEditor() {
  try {
    const c = localStorage.getItem('dll-levels-override');
    adminLevels = c ? JSON.parse(c) : await fetch('levels.json').then(r=>r.json());
  } catch { adminLevels = []; }
  renderList();
}

async function reloadFile() {
  if(!confirm('Reload from levels.json? Unsaved changes will be lost.')) return;
  localStorage.removeItem('dll-levels-override');
  try { adminLevels = await fetch('levels.json?'+Date.now()).then(r=>r.json()); }
  catch { adminLevels = []; }
  renderList(); showSt('Reloaded from levels.json','ok');
}

function clearOverride(){
  if(!confirm('Clear the localStorage override? Site reverts to levels.json.')) return;
  localStorage.removeItem('dll-levels-override');
  if(window.DLL?.reload) window.DLL.reload();
  reloadFile();
}

function renderList() {
  const c = document.getElementById('_adm-list');
  document.getElementById('_adm-cnt').textContent = `${adminLevels.length} level${adminLevels.length!==1?'s':''}`;
  if(!adminLevels.length){
    c.innerHTML=`<div class="adm-empty"><div class="adm-empty-i">📋</div>No levels yet. Click "Add Level" to start.</div>`;
    return;
  }
  c.innerHTML='';
  adminLevels.forEach((lvl,i)=>{
    const card = document.createElement('div');
    card.className='adm-card'; card.draggable=true; card.dataset.i=i;
    card.innerHTML=`
      <span class="adm-handle" title="Drag to reorder">⠿</span>
      <span class="adm-r">#${lvl.id}</span>
      <img class="adm-ico" src="assets/difficulty/${lvl.difficulty||'na'}.svg" alt="" onerror="this.src='assets/difficulty/na.svg'">
      <div class="adm-inf">
        <div class="adm-nm">${escHtml(lvl.name||'—')}</div>
        <div class="adm-sub">ID: ${escHtml(String(lvl.levelId||'—'))} · ${escHtml(lvl.creator||'—')} · video: ${escHtml(lvl.videoId||'—')}</div>
      </div>
      <span class="adm-diff-tag">${(lvl.difficulty||'n/a').replace(/_/g,' ')}</span>
      <div class="adm-acts">
        <button class="adm-ab" data-a="edit" data-i="${i}" title="Edit">✏️</button>
        <button class="adm-ab del" data-a="del" data-i="${i}" title="Delete">🗑</button>
      </div>`;
    card.querySelectorAll('[data-a]').forEach(b=>{
      b.addEventListener('click', e=>{
        e.stopPropagation();
        const idx=parseInt(b.dataset.i);
        if(b.dataset.a==='edit') openForm(idx);
        else delLevel(idx);
      });
    });
    card.addEventListener('dragstart',e=>{
      e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',i);
      setTimeout(()=>card.classList.add('dragging'),0);
    });
    card.addEventListener('dragend',()=>card.classList.remove('dragging'));
    card.addEventListener('dragover',e=>{e.preventDefault();card.classList.add('drag-over');});
    card.addEventListener('dragleave',()=>card.classList.remove('drag-over'));
    card.addEventListener('drop',e=>{
      e.preventDefault(); card.classList.remove('drag-over');
      const from=parseInt(e.dataTransfer.getData('text/plain'));
      if(from===i) return;
      const m=adminLevels.splice(from,1)[0]; adminLevels.splice(i,0,m);
      renum(); renderList();
    });
    c.appendChild(card);
  });
}

function openForm(idx){
  editingIndex=idx;
  document.getElementById('_adm-form-title').textContent = idx===null?'Add New Level':`Edit Level #${adminLevels[idx]?.id}`;
  const lvl = idx!==null ? adminLevels[idx] : {};
  document.getElementById('_ff-rank').value     = idx!==null ? lvl.id       : adminLevels.length+1;
  document.getElementById('_ff-lid').value      = lvl.levelId  ||'';
  document.getElementById('_ff-name').value     = lvl.name     ||'';
  document.getElementById('_ff-diff').value     = lvl.difficulty||'extreme_demon';
  document.getElementById('_ff-creator').value  = lvl.creator  ||'';
  document.getElementById('_ff-verifier').value = lvl.verifier ||'';
  document.getElementById('_ff-publisher').value= lvl.publisher||'';
  document.getElementById('_ff-vid').value      = lvl.videoId  ||'';
  document.getElementById('_adm-form-ov').classList.add('open');
  setTimeout(()=>document.getElementById('_ff-name').focus(),80);
}

function closeForm(){ document.getElementById('_adm-form-ov').classList.remove('open'); editingIndex=null; }

function submitForm(){
  const name=document.getElementById('_ff-name').value.trim();
  if(!name){ document.getElementById('_ff-name').focus(); return; }
  const entry={
    id:        parseInt(document.getElementById('_ff-rank').value)||adminLevels.length+1,
    levelId:   document.getElementById('_ff-lid').value.trim(),
    name,
    difficulty:document.getElementById('_ff-diff').value,
    creator:   document.getElementById('_ff-creator').value.trim(),
    verifier:  document.getElementById('_ff-verifier').value.trim(),
    publisher: document.getElementById('_ff-publisher').value.trim(),
    videoId:   document.getElementById('_ff-vid').value.trim(),
  };
  if(editingIndex!==null) adminLevels[editingIndex]=entry;
  else adminLevels.push(entry);
  adminLevels.sort((a,b)=>a.id-b.id); renum(); renderList(); closeForm();
  showSt(editingIndex!==null?'Level updated ✓':'Level added ✓','ok');
}

function delLevel(i){
  if(!confirm(`Delete "${adminLevels[i]?.name}"?`)) return;
  adminLevels.splice(i,1); renum(); renderList(); showSt('Deleted','ok');
}

function renum(){ adminLevels.forEach((l,i)=>{ l.id=i+1; }); }

function saveApply(){
  localStorage.setItem('dll-levels-override', JSON.stringify(adminLevels));
  if(window.DLL?.reload) window.DLL.reload();
  showSt('Saved & applied! 🎉','ok');
}

function syncJson(){ document.getElementById('_adm-jta').value = JSON.stringify(adminLevels,null,2); }
function fmtJson(){
  const ta=document.getElementById('_adm-jta');
  try{ ta.value=JSON.stringify(JSON.parse(ta.value),null,2); } catch{ showSt('Invalid JSON','err'); }
}
function applyJson(){
  try{
    adminLevels=JSON.parse(document.getElementById('_adm-jta').value);
    renderList(); switchTab('vis'); showSt('JSON applied','ok');
  } catch(e){ showSt('JSON Error: '+e.message,'err'); }
}

function switchTab(v){
  ['vis','json'].forEach(t=>{
    const el=document.getElementById(`_adm-${t}`);
    const btn=document.getElementById(`_t${t[0]}`);
    el.classList.toggle('hidden',t!==v);
    btn.classList.toggle('active',t===v);
  });
}

function showSt(msg,type){
  const el=document.getElementById('_adm-st');
  el.textContent=msg; el.className=`adm-st show ${type}`;
  setTimeout(()=>{ el.className='adm-st'; },3000);
}

function openAdmin(){
  injectAdminPanel();
  document.getElementById('_adm').classList.add('open');
  if(!adminAuthed){
    setTimeout(()=>document.getElementById('_adm-pi')?.focus(),120);
  } else {
    document.getElementById('_adm-pw-wrap').style.display='none';
    document.getElementById('_adm-editor-wrap').style.display='';
    loadEditor();
  }
}
function closeAdmin(){ document.getElementById('_adm')?.classList.remove('open'); }

document.addEventListener('keydown', e=>{
  if(e.ctrlKey && e.shiftKey && e.key==='S'){ e.preventDefault(); openAdmin(); }
});
