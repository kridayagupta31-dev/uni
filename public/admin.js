(() => {
  const S = window.SITE;
  const $ = (s) => document.querySelector(s);
  const show = (el, on = true) => el.classList.toggle("hidden", !on);
  let token = ssGet("adminTok");
  let subs = [];
  let accounts = [];
  let filter = "pending";

  function ssGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
  function ssSet(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} }

  async function api(path, opts = {}) {
    const headers = { authorization: `Bearer ${token}` };
    let body = opts.body;
    if (body) { headers["content-type"] = "application/json"; body = JSON.stringify(body); }
    const r = await fetch(`/api/admin/${path}`, { ...opts, headers, body });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { logout(); throw new Error(data.error || "Please log in again."); }
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  }
  const fileUrl = (s, type, download) =>
    `/api/admin/file/${s.id}/${type}?t=${encodeURIComponent(token)}&v=${encodeURIComponent(s.updatedAt)}${download ? `&download=${encodeURIComponent(download)}` : ""}`;

  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    show(t);
    clearTimeout(toast.t);
    toast.t = setTimeout(() => show(t, false), 2500);
  }
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function caption(s) {
    const first = s.fullName.split(" ")[0];
    const ig = S.instagram ? "Want to get posted? Link in bio!" : "Want to get posted? Ask us for the link!";
    return `🎓 ${s.fullName} is headed to ${s.university} to study ${s.subject}! Congratulations ${first} 💫\n\n${ig}\n${S.hashtags}`;
  }

  // ---------- login ----------
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const btn = $("#loginBtn"), err = $("#loginError");
    btn.disabled = true;
    btn.textContent = "Checking…";
    show(err, false);
    try {
      const r = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Login failed.");
      token = data.token;
      ssSet("adminTok", token);
      await openDesk(data.email);
    } catch (ex) {
      err.textContent = ex.message;
      show(err);
    } finally {
      btn.disabled = false;
      btn.textContent = "Open posting desk";
    }
  });

  function logout() {
    token = null;
    ssSet("adminTok", null);
    show($("#deskView"), false);
    show($("#who"), false);
    show($("#logout"), false);
    show($("#loginView"));
  }
  $("#logout").onclick = logout;

  async function openDesk(email) {
    $("#who").textContent = email;
    show($("#who"));
    show($("#logout"));
    show($("#loginView"), false);
    show($("#deskView"));
    await load();
  }

  async function load() {
    try {
      const [a, b] = await Promise.all([api("submissions"), api("accounts")]);
      subs = a.submissions;
      accounts = b.accounts;
      show($("#deskError"), false);
      draw();
    } catch (ex) {
      $("#deskError").textContent = ex.message;
      show($("#deskError"));
    }
  }

  // ---------- desk ----------
  function draw() {
    $("#stAll").textContent = subs.length;
    $("#stPending").textContent = subs.filter((s) => s.status === "pending").length;
    $("#stPosted").textContent = subs.filter((s) => s.status === "posted").length;
    $("#stWaiting").textContent = accounts.filter((a) => !a.submitted).length;
    document.querySelectorAll("#filters button").forEach((b) => b.classList.toggle("on", b.dataset.f === filter));

    const q = $("#search").value.trim().toLowerCase();
    const list = subs.filter((s) => (filter === "all" || s.status === filter) &&
      `${s.fullName} ${s.university} ${s.subject} ${s.email}`.toLowerCase().includes(q));

    const grid = $("#grid");
    grid.innerHTML = "";
    if (!list.length) {
      const empty = el("div", "empty");
      empty.style.gridColumn = "1 / -1";
      empty.append(el("div", "stamp", "📭"), el("h2", null, subs.length ? "Nothing here" : "No submissions yet"),
        el("p", null, subs.length ? "Try a different filter or search." : "Share the link in your bio. Graphics will land here as classmates submit."));
      grid.appendChild(empty);
    }
    list.forEach((s, i) => grid.appendChild(cardFor(s, i)));

    const rows = $("#accRows");
    rows.innerHTML = "";
    for (const a of accounts) {
      const tr = el("tr");
      tr.append(el("td", null, a.name), el("td", null, a.email),
        el("td", null, new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
        el("td", null, a.submitted ? "✓" : "–"));
      const td = el("td");
      const rm = el("button", "link danger", "Remove account");
      rm.onclick = async () => {
        if (!confirm(`Remove ${a.name}'s account? They can sign up again with the same email.`)) return;
        try { await api(`accounts/${a.id}`, { method: "DELETE" }); toast("Account removed"); load(); }
        catch (ex) { alert(ex.message); }
      };
      td.appendChild(rm);
      tr.appendChild(td);
      rows.appendChild(tr);
    }
    if (!accounts.length) {
      const tr = el("tr"); const td = el("td", "hint", "No accounts yet."); td.colSpan = 5; tr.appendChild(td); rows.appendChild(tr);
    }
  }

  function cardFor(s, i) {
    const base = `${slug(s.fullName)}-${slug(s.university)}`;
    const card = el("article", "sub-card reveal");
    card.style.animationDelay = `${Math.min(i, 8) * 40}ms`;

    const art = el("a", "sub-art");
    art.href = fileUrl(s, "graphic");
    art.target = "_blank";
    art.rel = "noreferrer";
    const img = el("img");
    img.src = fileUrl(s, "graphic");
    img.alt = `${s.fullName} graphic`;
    img.loading = "lazy";
    art.append(img, el("span", `pill ${s.status === "posted" ? "pill-posted" : "pill-pending"}`, s.status === "posted" ? "Posted" : "To post"));

    const body = el("div", "sub-body");
    const top = el("div", "sub-top");
    const baby = el("img", "sub-baby");
    baby.src = fileUrl(s, "baby");
    baby.alt = "";
    baby.loading = "lazy";
    const who = el("div");
    who.append(el("h3", null, s.fullName), el("p", "muted", s.email));
    top.append(baby, who);

    const facts = el("dl", "facts compact");
    for (const [k, v] of [
      ["University", s.university],
      ["Subject", s.subject],
      ["Consent", s.consent ? "Yes" : "No"],
      ["Submitted", new Date(s.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })],
    ]) {
      const d = el("div");
      d.append(el("dt", null, k), el("dd", null, v));
      facts.appendChild(d);
    }

    const a1 = el("div", "sub-actions");
    const g = el("a", "btn btn-sm btn-primary", "Graphic ↓");
    g.href = fileUrl(s, "graphic", `${base}-graphic.jpg`);
    const b = el("a", "btn btn-sm btn-ghost", "Baby pic ↓");
    b.href = fileUrl(s, "baby", `${base}-baby.jpg`);
    const cap = el("button", "btn btn-sm btn-ghost", "Copy caption");
    cap.onclick = async () => {
      await navigator.clipboard.writeText(caption(s)).catch(() => {});
      cap.textContent = "Copied!";
      setTimeout(() => (cap.textContent = "Copy caption"), 1800);
    };
    a1.append(g, b, cap);

    const a2 = el("div", "sub-actions spread");
    const toggle = s.status === "pending" ? el("button", "btn btn-sm btn-ok", "✓ Mark posted") : el("button", "btn btn-sm btn-ghost", "Move back to queue");
    toggle.onclick = async () => {
      toggle.disabled = true;
      try {
        const r = await api(`submissions/${s.id}`, { method: "PATCH", body: { status: s.status === "pending" ? "posted" : "pending" } });
        subs = subs.map((x) => (x.id === s.id ? r.submission : x));
        draw();
      } catch (ex) { alert(ex.message); toggle.disabled = false; }
    };
    const del = el("button", "link danger", "Delete");
    del.onclick = async () => {
      if (!confirm(`Delete ${s.fullName}'s submission? They'll be able to submit again.`)) return;
      try { await api(`submissions/${s.id}`, { method: "DELETE" }); subs = subs.filter((x) => x.id !== s.id); load(); }
      catch (ex) { alert(ex.message); }
    };
    a2.append(toggle, del);

    body.append(top, facts, a1, a2);
    card.append(art, body);
    return card;
  }

  document.querySelectorAll("#filters button").forEach((b) => (b.onclick = () => { filter = b.dataset.f; draw(); }));
  $("#search").addEventListener("input", draw);
  $("#refreshBtn").onclick = load;
  $("#csvBtn").onclick = () => { location.href = `/api/admin/export.csv?t=${encodeURIComponent(token)}`; };

  $("#zipBtn").onclick = async () => {
    const btn = $("#zipBtn");
    if (!subs.length || !window.JSZip) return;
    btn.disabled = true;
    const zip = new JSZip();
    const gf = zip.folder("graphics"), bf = zip.folder("baby-pics");
    let n = 0;
    for (const s of subs) {
      btn.textContent = `Zipping ${++n}/${subs.length}…`;
      const base = `${slug(s.fullName)}-${slug(s.university)}`;
      for (const [type, folder] of [["graphic", gf], ["baby", bf]]) {
        try { const r = await fetch(fileUrl(s, type)); if (r.ok) folder.file(`${base}.jpg`, await r.blob()); } catch {}
      }
    }
    const cols = ["fullName", "university", "subject", "email", "status"];
    zip.file("details.csv", "﻿" + [cols.join(","), ...subs.map((s) => cols.map((c) => `"${String(s[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n"));
    zip.file("captions.txt", subs.map(caption).join("\n\n────────\n\n"));
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "batch-2027-graphics.zip";
    a.click();
    btn.disabled = false;
    btn.textContent = "Download all (.zip)";
  };

  (async () => {
    if (!token) return show($("#loginView"));
    try {
      const me = await api("me");
      await openDesk(me.email);
    } catch {
      logout();
    }
  })();
})();
