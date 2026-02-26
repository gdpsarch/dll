const ADMIN_HASH = "58e0e772df3698463ec16e70c9a5dd77f2149187c23c3e324b1c572e61d30061";

const ADMIN_SB_KEY = "sb_secret_pMcmpUBsqLiYFiru501D7A_Ba6h10lr";

(function _adm() {
  "use strict";

  const adminModal      = document.getElementById("adminModal");
  const adminAuth       = document.getElementById("adminAuth");
  const adminEditor     = document.getElementById("adminEditor");
  const adminPass       = document.getElementById("adminPass");
  const adminAuthBtn    = document.getElementById("adminAuthBtn");
  const adminAuthNote   = document.getElementById("adminAuthNote");
  const adminModalClose = document.getElementById("adminModalClose");
  const adminTabs       = document.querySelectorAll(".admin-tab");
  const adminTabAdd     = document.getElementById("adminTabAdd");
  const adminTabEdit    = document.getElementById("adminTabEdit");
  const adminSelectLevel= document.getElementById("adminSelectLevel");
  const adminEditForm   = document.getElementById("adminEditForm");
  const adminAddNote    = document.getElementById("adminAddNote");
  const adminEditNote   = document.getElementById("adminEditNote");

  let _auth = false;
  let _editingId = null;

  async function _sha256(str) {
    const buf  = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
  }

  function _aHeaders(extra = {}) {
    return {
      "Content-Type": "application/json",
      "apikey": ADMIN_SB_KEY,
      "Authorization": `Bearer ${ADMIN_SB_KEY}`,
      "Prefer": "return=representation",
      ...extra
    };
  }

  const _url = () => `${window._d3n1.SUPABASE_URL}/rest/v1/levels`;

  document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.shiftKey && e.key === "S") {
      e.preventDefault();
      openAdmin();
    }
  });

  function openAdmin() {
    adminModal.classList.remove("hidden");
    if (!_auth) {
      adminAuth.classList.remove("hidden");
      adminEditor.classList.add("hidden");
      adminPass.value = "";
      window._d3n1.setNote(adminAuthNote, "", "");
    } else {
      adminAuth.classList.add("hidden");
      adminEditor.classList.remove("hidden");
    }
  }

  adminModalClose.addEventListener("click", () => adminModal.classList.add("hidden"));
  adminModal.addEventListener("click", e => { if (e.target === adminModal) adminModal.classList.add("hidden"); });

  adminAuthBtn.addEventListener("click", async () => {
    const input = adminPass.value;
    if (!input) { window._d3n1.setNote(adminAuthNote, "error", "Enter password."); return; }
    adminAuthBtn.disabled = true;
    adminAuthBtn.textContent = "Checking…";
    try {
      const hash = await _sha256(input);
      if (hash === ADMIN_HASH) {
        _auth = true;
        adminAuth.classList.add("hidden");
        adminEditor.classList.remove("hidden");
        await _populateEditSelect();
      } else {
        window._d3n1.setNote(adminAuthNote, "error", "❌ Wrong password.");
      }
    } finally {
      adminAuthBtn.disabled = false;
      adminAuthBtn.textContent = "Authenticate";
    }
  });
  adminPass.addEventListener("keydown", e => { if (e.key === "Enter") adminAuthBtn.click(); });

  adminTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      adminTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const name = tab.dataset.tab;
      adminTabAdd.classList.toggle("hidden", name !== "add");
      adminTabEdit.classList.toggle("hidden", name !== "edit");
      if (name === "edit") _populateEditSelect();
    });
  });

  document.getElementById("adminAddBtn").addEventListener("click", async () => {
    const body = _collectAddForm();
    if (!body) return;
    try {
      const resp = await fetch(_url(), {
        method: "POST",
        headers: _aHeaders(),
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(await resp.text());
      window._d3n1.setNote(adminAddNote, "success", "✓ Level added!");
      _clearAddForm();
      await window._d3n1.reload();
      await _populateEditSelect();
    } catch (e) {
      window._d3n1.setNote(adminAddNote, "error", `Error: ${e.message}`);
    }
  });

  function _collectAddForm() {
    const get = id => document.getElementById(id).value.trim();
    const pos = parseInt(get("a_position"), 10);
    if (!pos || !get("a_level_id") || !get("a_name") || !get("a_creator") || !get("a_verifier") || !get("a_publisher") || !get("a_video")) {
      window._d3n1.setNote(adminAddNote, "error", "Fill in all fields.");
      return null;
    }
    try { new URL(get("a_video")); } catch {
      window._d3n1.setNote(adminAddNote, "error", "Invalid video URL.");
      return null;
    }
    return {
      position:        pos,
      level_id:        get("a_level_id"),
      name:            get("a_name"),
      difficulty_icon: get("a_difficulty"),
      creator:         get("a_creator"),
      verifier:        get("a_verifier"),
      publisher:       get("a_publisher"),
      video_url:       get("a_video")
    };
  }

  function _clearAddForm() {
    ["a_position","a_level_id","a_name","a_creator","a_verifier","a_publisher","a_video"].forEach(id => {
      document.getElementById(id).value = "";
    });
  }

  async function _populateEditSelect() {
    const levels = await window._d3n1.reload();
    adminSelectLevel.innerHTML = '<option value="">— Select a level —</option>';
    levels.forEach(l => {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = `#${l.position} — ${l.name}`;
      adminSelectLevel.appendChild(opt);
    });
    adminEditForm.classList.add("hidden");
    _editingId = null;
  }

  adminSelectLevel.addEventListener("change", () => {
    const id = adminSelectLevel.value;
    if (!id) { adminEditForm.classList.add("hidden"); _editingId = null; return; }
    _editingId = id;
    const levels = window._d3n1.reload ? null : null;
    fetch(`${_url()}?id=eq.${id}&select=*`, { headers: _aHeaders() })
      .then(r => r.json())
      .then(rows => {
        if (!rows.length) return;
        const l = rows[0];
        document.getElementById("e_position").value   = l.position;
        document.getElementById("e_level_id").value   = l.level_id;
        document.getElementById("e_name").value        = l.name;
        document.getElementById("e_difficulty").value  = l.difficulty_icon;
        document.getElementById("e_creator").value    = l.creator;
        document.getElementById("e_verifier").value   = l.verifier;
        document.getElementById("e_publisher").value  = l.publisher;
        document.getElementById("e_video").value      = l.video_url;
        adminEditForm.classList.remove("hidden");
      })
      .catch(e => window._d3n1.setNote(adminEditNote, "error", e.message));
  });

  document.getElementById("adminUpdateBtn").addEventListener("click", async () => {
    if (!_editingId) return;
    const body = _collectEditForm();
    if (!body) return;
    try {
      const resp = await fetch(`${_url()}?id=eq.${_editingId}`, {
        method: "PATCH",
        headers: _aHeaders(),
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(await resp.text());
      window._d3n1.setNote(adminEditNote, "success", "✓ Level updated!");
      await window._d3n1.reload();
      await _populateEditSelect();
    } catch (e) {
      window._d3n1.setNote(adminEditNote, "error", `Error: ${e.message}`);
    }
  });

  function _collectEditForm() {
    const get = id => document.getElementById(id).value.trim();
    const pos = parseInt(get("e_position"), 10);
    if (!pos || !get("e_level_id") || !get("e_name") || !get("e_creator") || !get("e_verifier") || !get("e_publisher") || !get("e_video")) {
      window._d3n1.setNote(adminEditNote, "error", "Fill in all fields.");
      return null;
    }
    return {
      position:        pos,
      level_id:        get("e_level_id"),
      name:            get("e_name"),
      difficulty_icon: get("e_difficulty"),
      creator:         get("e_creator"),
      verifier:        get("e_verifier"),
      publisher:       get("e_publisher"),
      video_url:       get("e_video")
    };
  }

  document.getElementById("adminDeleteBtn").addEventListener("click", async () => {
    if (!_editingId) return;
    const levelName = adminSelectLevel.options[adminSelectLevel.selectedIndex].textContent;
    if (!confirm(`Delete "${levelName}"? This cannot be undone.`)) return;
    try {
      const resp = await fetch(`${_url()}?id=eq.${_editingId}`, {
        method: "DELETE",
        headers: _aHeaders({ "Prefer": "" })
      });
      if (!resp.ok) throw new Error(await resp.text());
      window._d3n1.setNote(adminEditNote, "success", "✓ Level deleted.");
      await window._d3n1.reload();
      await _populateEditSelect();
    } catch (e) {
      window._d3n1.setNote(adminEditNote, "error", `Error: ${e.message}`);
    }
  });

})();
