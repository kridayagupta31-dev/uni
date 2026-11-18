(() => {
  const S = window.SITE;
  const G = window.Graphic;
  const $ = (s) => document.querySelector(s);
  const show = (el, on = true) => el.classList.toggle("hidden", !on);

  const st = {
    token: lsGet("tok"),
    user: null,
    submission: null,
    editing: false,
    authMode: "signup",
    uni: null,             // {name, wiki}
    assets: { seal: null, wordmark: null, photos: [] },
    assetsLoading: false,
    primary: "#7A1F2B",
    accent: "#F2C14E",
    colorsManual: false,
    badge: "seal",
    seed: Math.floor(Math.random() * 1e6) + 1,
    baby: null,            // Image
    babyBlob: null,        // new upload only
    transform: { zoom: 1, x: 0, y: 0 },
  };

  function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }

  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (st.token) headers.authorization = `Bearer ${st.token}`;
    let body = opts.body;
    if (body && typeof body !== "string") { headers["content-type"] = "application/json"; body = JSON.stringify(body); }
    const r = await fetch(`/api/${path}`, { ...opts, headers, body });
    if (opts.raw) { if (!r.ok) throw new Error("Request failed"); return r; }
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && st.user) logout();
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  }

  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    show(t);
    clearTimeout(toast.t);
    toast.t = setTimeout(() => show(t, false), 3500);
  }
  $("#toast").onclick = () => show($("#toast"), false);

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  // ---------- views ----------
  function view(name) {
    show($("#landing"), name === "landing");
    show($("#builder"), name === "builder");
    show($("#submitted"), name === "submitted");
    const loggedIn = !!st.user;
    show($("#navMine"), loggedIn);
    show($("#navLogout"), loggedIn);
    show($("#navIg"), !loggedIn && !!S.instagram);
    $("#navMine").classList.toggle("on", name !== "landing");
    show($("#authCard"), !loggedIn);
    show($("#continueCard"), loggedIn);
    window.scrollTo({ top: 0 });
    if (name === "landing") drawSamples();
  }

  function openMine() {
    if (st.submission && !st.editing) { renderSubmitted(); view("submitted"); }
    else { view("builder"); redraw(); }
  }

  // ---------- auth ----------
  function setMode(mode) {
    st.authMode = mode;
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === mode));
    show($("#nameField"), mode === "signup");
    show($("#emailHint"), mode === "signup");
    show($("#forgotHint"), mode === "login");
    $("#authBtn").textContent = mode === "signup" ? "Create my login" : "Log in";
    $("#authForm [name=password]").autocomplete = mode === "signup" ? "new-password" : "current-password";
    show($("#authError"), false);
  }
  document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => setMode(b.dataset.tab)));

  $("#authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const err = $("#authError");
    const fail = (m) => { err.textContent = m; show(err); };
    if (st.authMode === "signup" && !f.fullName.trim()) return fail("Enter your full name.");
    if (!f.email.trim()) return fail("Enter your school email.");
    if (f.password.length < 8) return fail("Password needs at least 8 characters.");
    const btn = $("#authBtn");
    btn.disabled = true;
    btn.textContent = "One sec…";
    show(err, false);
    try {
      const r = await api(st.authMode, { method: "POST", body: f });
      st.token = r.token;
      lsSet("tok", r.token);
      await boot();
      toast(st.authMode === "signup" ? "You’re in! Let’s make your graphic." : "Welcome back!");
    } catch (ex) {
      fail(ex.message);
    } finally {
      btn.disabled = false;
      btn.textContent = st.authMode === "signup" ? "Create my login" : "Log in";
    }
  });

  function logout() {
    st.token = null; st.user = null; st.submission = null; st.editing = false;
    lsSet("tok", null);
    view("landing");
  }
  $("#navLogout").onclick = logout;
  $("#navMine").onclick = (e) => { e.preventDefault(); openMine(); };
  $("#continueBtn").onclick = openMine;
  $("#brandLink").onclick = (e) => { e.preventDefault(); view("landing"); };

  // ---------- university picker ----------
  const uniInput = $("#fUni"), uniList = $("#uniList");
  let remote = [], searching = false, active = 0, opts = [], searchTimer;

  function buildOptions() {
    const q = uniInput.value.trim();
    const local = G.searchLocal(q, 6);
    const seen = new Set(local.map((u) => u.wiki.replace(/_/g, " ")));
    opts = [
      ...local.map((u) => ({ name: u.name, wiki: u.wiki, swatch: [u.primary, u.accent] })),
      ...remote.filter((r) => !seen.has(r.title)).slice(0, 5).map((r) => ({ name: r.title, wiki: r.title.replace(/ /g, "_"), hint: r.description })),
    ];
    if (q.length >= 3 && !opts.some((o) => o.name.toLowerCase() === q.toLowerCase()))
      opts.push({ name: q, wiki: null, hint: "Use exactly as typed" });
    active = Math.min(active, Math.max(0, opts.length - 1));
    uniList.innerHTML = "";
    opts.forEach((o, i) => {
      const li = document.createElement("li");
      li.role = "option";
      li.className = i === active ? "active" : "";
      const dot = document.createElement("i");
      if (o.swatch) { dot.className = "dot"; dot.style.background = `linear-gradient(135deg, ${o.swatch[0]} 55%, ${o.swatch[1]} 55%)`; }
      else { dot.className = "dot dot-empty"; dot.textContent = o.wiki ? "W" : "✎"; }
      const txt = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = o.name;
      txt.appendChild(strong);
      if (o.hint) { const sm = document.createElement("small"); sm.textContent = o.hint; txt.appendChild(sm); }
      li.append(dot, txt);
      li.onmouseenter = () => { active = i; buildOptions(); };
      li.onmousedown = (e) => { e.preventDefault(); pickUni(o); };
      uniList.appendChild(li);
    });
    if (searching) { const li = document.createElement("li"); li.className = "searching"; li.textContent = "Searching more schools…"; uniList.appendChild(li); }
    else if (!opts.length) { const li = document.createElement("li"); li.className = "searching"; li.textContent = "Keep typing…"; uniList.appendChild(li); }
    const open = document.activeElement === uniInput && q.length > 0;
    show(uniList, open);
    uniInput.setAttribute("aria-expanded", open);
  }

  uniInput.addEventListener("input", () => {
    active = 0;
    remote = [];
    const q = uniInput.value.trim();
    clearTimeout(searchTimer);
    if (q.length >= 3) {
      searching = true;
      searchTimer = setTimeout(async () => {
        try {
          const r = await fetch(`/api/universities/search?q=${encodeURIComponent(q)}`);
          remote = r.ok ? (await r.json()).results : [];
        } catch { remote = []; }
        searching = false;
        if (uniInput.value.trim() === q) buildOptions();
      }, 320);
    } else searching = false;
    buildOptions();
  });
  uniInput.addEventListener("focus", buildOptions);
  uniInput.addEventListener("blur", () => setTimeout(() => show(uniList, false), 120));
  uniInput.addEventListener("keydown", (e) => {
    if (uniList.classList.contains("hidden") || !opts.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(opts.length - 1, active + 1); buildOptions(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); buildOptions(); }
    else if (e.key === "Enter") { e.preventDefault(); pickUni(opts[active]); }
    else if (e.key === "Escape") show(uniList, false);
  });

  function pickUni(o, { keepColors = false } = {}) {
    uniInput.value = o.name;
    show(uniList, false);
    uniInput.blur();
    st.uni = { name: o.name, wiki: o.wiki };
    const known = G.UNIS.find((u) => u.wiki === o.wiki);
    if (!keepColors) {
      st.colorsManual = false;
      if (known) setColors(known.primary, known.accent);
    }
    loadUniAssets(!!known || keepColors);
    updateNeed();
    redraw();
  }

  let assetReq = 0;
  async function loadUniAssets(colorsSet) {
    const id = ++assetReq;
    const note = $("#uniNote");
    st.assets = { seal: null, wordmark: null, photos: [] };
    if (!st.uni?.wiki) {
      show(note, false);
      updateStyleControls();
      return;
    }
    st.assetsLoading = true;
    $("#previewLoading").textContent = `Fetching ${st.uni.name} campus photos…`;
    show($("#previewLoading"));
    try {
      const a = await G.loadAssets(st.uni.wiki);
      if (id !== assetReq) return;
      st.assets = a;
      if (!colorsSet && !st.colorsManual && a.seal) {
        const c = G.colorsFromImage(a.seal);
        if (c) setColors(c.primary, c.accent);
      }
      note.className = a.seal || a.photos.length ? "ok-note" : "";
      note.textContent = a.seal || a.photos.length ? "✓ Seal and campus photos found automatically" : "No photos found for this name. Your graphic will use a pattern instead.";
      show(note);
    } finally {
      if (id === assetReq) {
        st.assetsLoading = false;
        show($("#previewLoading"), false);
        updateStyleControls();
        redraw();
      }
    }
  }

  // ---------- style ----------
  function setColors(p, a) {
    st.primary = p.toUpperCase();
    st.accent = a.toUpperCase();
    $("#fPrimary").value = st.primary.toLowerCase();
    $("#fAccent").value = st.accent.toLowerCase();
    $("#swPrimary").style.background = st.primary;
    $("#swAccent").style.background = st.accent;
  }
  $("#fPrimary").addEventListener("input", (e) => { setColors(e.target.value, st.accent); st.colorsManual = true; redraw(); });
  $("#fAccent").addEventListener("input", (e) => { setColors(st.primary, e.target.value); st.colorsManual = true; redraw(); });
  $("#shuffleBtn").onclick = () => { st.seed = Math.floor(Math.random() * 1e6) + 1; redraw(); };
  document.querySelectorAll("[data-badge]").forEach((b) => (b.onclick = () => { st.badge = b.dataset.badge; updateStyleControls(); redraw(); }));

  function updateStyleControls() {
    if (!st.assets.wordmark && st.badge === "wordmark") st.badge = "seal";
    $("#shuffleBtn").disabled = !st.assets.photos.length;
    document.querySelectorAll("[data-badge]").forEach((b) => {
      b.classList.toggle("on", b.dataset.badge === st.badge);
      b.setAttribute("aria-checked", b.dataset.badge === st.badge);
      if (b.dataset.badge === "wordmark") {
        b.disabled = !st.assets.wordmark;
        b.title = st.assets.wordmark ? "" : "No official logo found for this school";
      }
    });
  }

  // ---------- baby photo ----------
  const dz = $("#dropzone"), fileIn = $("#fBaby");
  dz.onclick = () => fileIn.click();
  dz.onkeydown = (e) => (e.key === "Enter" || e.key === " ") && fileIn.click();
  dz.ondragover = (e) => { e.preventDefault(); dz.classList.add("over"); };
  dz.ondragleave = () => dz.classList.remove("over");
  dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove("over"); setBaby(e.dataTransfer.files[0]); };
  fileIn.onchange = (e) => setBaby(e.target.files[0]);

  async function shrink(file, max = 1800) {
    const url = URL.createObjectURL(file);
    try {
      const img = await G.loadImage(url);
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.9));
      return { blob, img: await G.loadImage(URL.createObjectURL(blob)) };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function setBaby(file) {
    const err = $("#babyError");
    show(err, false);
    if (!file) return;
    if (!file.type.startsWith("image/")) { err.textContent = "That file isn’t an image. Try a JPG or PNG."; return show(err); }
    try {
      const { blob, img } = await shrink(file);
      st.baby = img;
      st.babyBlob = blob;
      st.transform = { zoom: 1, x: 0, y: 0 };
      $("#fZoom").value = 1;
      babyUi();
      updateNeed();
      redraw();
    } catch {
      err.textContent = "We couldn’t read that photo. Try a JPG or PNG (screenshots work too).";
      show(err);
    }
  }
  function babyUi() {
    const has = !!st.baby;
    show($("#dzIcon"), !has);
    show($("#dzImg"), has);
    if (has) $("#dzImg").src = st.baby.src;
    $("#dzTitle").textContent = has ? "Looking adorable." : "Drop a baby photo";
    $("#dzSub").textContent = has ? "Tap to swap photo" : "or tap to choose · JPG / PNG";
    dz.classList.toggle("has", has);
    show($("#zoomRow"), has);
    show($("#dragHint"), has);
    $("#preview").classList.toggle("draggable", has);
  }
  $("#fZoom").oninput = (e) => { st.transform.zoom = +e.target.value; redraw(); };
  $("#zoomReset").onclick = () => { st.transform = { zoom: 1, x: 0, y: 0 }; $("#fZoom").value = 1; redraw(); };

  // drag to reposition
  const canvas = $("#preview");
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (!st.baby) return;
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const k = G.W / canvas.getBoundingClientRect().width;
    const dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k;
    drag = { x: e.clientX, y: e.clientY };
    const P = G.PHOTO, b = st.baby;
    const s = Math.max(P.w / b.naturalWidth, P.h / b.naturalHeight) * st.transform.zoom;
    const ox = (b.naturalWidth * s - P.w) / 2, oy = (b.naturalHeight * s - P.h) / 2;
    st.transform.x = ox > 0 ? Math.max(-1, Math.min(1, st.transform.x - dx / ox)) : 0;
    st.transform.y = oy > 0 ? Math.max(-1, Math.min(1, st.transform.y - dy / oy)) : 0;
    redraw();
  });
  const endDrag = () => (drag = null);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  // ---------- render ----------
  function input() {
    return {
      name: $("#fName").value.trim(),
      subject: $("#fSubject").value.trim(),
      university: st.uni?.name || "",
      primary: st.primary,
      accent: st.accent,
      baby: st.baby,
      seal: st.assets.seal,
      wordmark: st.assets.wordmark,
      backdrop: st.assets.photos,
      badgeStyle: st.badge,
      transform: st.transform,
      seed: st.seed,
      footer: S.footer,
    };
  }
  let raf = 0;
  function redraw() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => G.render(canvas, input()));
  }

  $("#fName").addEventListener("input", () => { updateNeed(); redraw(); });
  $("#fSubject").addEventListener("input", () => { updateNeed(); redraw(); });
  $("#fConsent").addEventListener("change", updateNeed);

  function missing() {
    return [
      !$("#fName").value.trim() && "your name",
      !st.uni && "your university",
      !$("#fSubject").value.trim() && "your subject",
      !st.baby && "a baby photo",
      !$("#fConsent").checked && "the consent tick",
    ].filter(Boolean);
  }
  function updateNeed() {
    const m = missing();
    $("#submitBtn").disabled = m.length > 0;
    $("#needHint").textContent = m.length ? `Still need ${m.join(", ").replace(/, ([^,]*)$/, " and $1")}.` : "";
  }

  // ---------- submit ----------
  const toDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });

  $("#submitBtn").onclick = async () => {
    if (missing().length) return updateNeed();
    const btn = $("#submitBtn"), err = $("#submitError");
    btn.disabled = true;
    btn.textContent = "Uploading…";
    show(err, false);
    try {
      G.render(canvas, input());
      let graphic;
      try { graphic = canvas.toDataURL("image/jpeg", 0.94); }
      catch { throw new Error("One of the university images couldn’t be used. Hit “Shuffle backdrop” or switch the badge style and try again."); }
      const body = {
        fullName: $("#fName").value.trim(),
        subject: $("#fSubject").value.trim(),
        university: st.uni.name,
        universityWiki: st.uni.wiki,
        primaryColor: st.primary,
        accentColor: st.accent,
        badgeStyle: st.badge,
        consent: $("#fConsent").checked,
        graphic,
        babyPhoto: st.babyBlob ? await toDataUrl(st.babyBlob) : null,
      };
      const r = await api("submission", { method: "POST", body });
      st.submission = r.submission;
      st.babyBlob = null;
      st.editing = false;
      graphicUrl = null;
      openMine();
      toast("Submitted! You’re in the posting queue.");
    } catch (ex) {
      err.textContent = ex.message;
      show(err);
    } finally {
      btn.textContent = st.submission ? "Save changes" : "Submit to get posted";
      updateNeed();
    }
  };
  $("#cancelEdit").onclick = () => { st.editing = false; openMine(); };

  // ---------- submitted ----------
  let graphicUrl = null;
  async function myGraphicUrl() {
    if (graphicUrl) return graphicUrl;
    const r = await api("mine/graphic", { raw: true });
    graphicUrl = URL.createObjectURL(await r.blob());
    return graphicUrl;
  }
  async function renderSubmitted() {
    const s = st.submission;
    const posted = s.status === "posted";
    $("#sPill").className = `pill ${posted ? "pill-posted" : "pill-pending"}`;
    $("#sPill").textContent = posted ? "Posted on the gram 🎉" : "In the posting queue";
    $("#sTitle").textContent = posted ? "You’re officially on the grid." : `You’re in, ${s.fullName.split(" ")[0]}!`;
    $("#sLede").textContent = posted
      ? "Your commit graphic is live. Go hype it up."
      : "Your graphic is with the page admins and will be posted soon. You can still tweak it until it goes live.";
    $("#sName").textContent = s.fullName;
    $("#sUni").textContent = s.university;
    $("#sSubject").textContent = s.subject;
    show($("#sEdit"), !posted);
    try { $("#sImg").src = await myGraphicUrl(); } catch {}
  }
  $("#sDownload").onclick = async () => {
    const a = document.createElement("a");
    a.href = await myGraphicUrl();
    a.download = `${slug(st.submission.fullName)}-${slug(st.submission.university)}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  $("#sEdit").onclick = () => {
    st.editing = true;
    show($("#cancelEdit"));
    $("#submitBtn").textContent = "Save changes";
    view("builder");
    redraw();
  };

  // ---------- fill builder from saved submission ----------
  async function fillFromSubmission(s) {
    $("#fName").value = s.fullName;
    $("#fSubject").value = s.subject;
    $("#fConsent").checked = !!s.consent;
    st.badge = s.badgeStyle || "seal";
    setColors(s.primaryColor, s.accentColor);
    st.colorsManual = true;
    pickUni({ name: s.university, wiki: s.universityWiki }, { keepColors: true });
    try {
      const r = await api("mine/baby", { raw: true });
      st.baby = await G.loadImage(URL.createObjectURL(await r.blob()));
      babyUi();
    } catch {}
    updateNeed();
    redraw();
  }

  // ---------- landing samples ----------
  let samplesDrawn = false;
  async function drawSamples() {
    if (samplesDrawn) return;
    samplesDrawn = true;
    const samples = [
      ["#sampleA", { name: "Rohan Mehta", subject: "Mathematics", university: "University of California, San Diego", wiki: "University_of_California,_San_Diego", primary: "#182B49", accent: "#F2C14E", seed: 42 }],
      ["#sampleB", { name: "Anaya Kapoor", subject: "Computer Science", university: "University of Massachusetts Amherst", wiki: "University_of_Massachusetts_Amherst", primary: "#881C1C", accent: "#F2C14E", seed: 7 }],
    ];
    for (const [sel, d] of samples) {
      const draw = (a = { seal: null, wordmark: null, photos: [] }) =>
        G.render($(sel), { ...d, seal: a.seal, wordmark: a.wordmark, backdrop: a.photos, footer: S.footer });
      draw();
      G.loadAssets(d.wiki).then(draw).catch(() => {});
    }
  }

  // ---------- init ----------
  (function initStatic() {
    for (const s of S.subjects) { const o = document.createElement("option"); o.value = s; $("#subjects").appendChild(o); }
    if (S.instagram) {
      $("#navIg").href = `https://instagram.com/${S.instagram}`;
      $("#navIg").textContent = `@${S.instagram}`;
      $("#stepFour").textContent = `Get posted on @${S.instagram}`;
      $("#footIg").textContent = `Made for the grid with ♥, get posted on @${S.instagram}`;
    }
    setColors(st.primary, st.accent);
    setMode("signup");
    updateStyleControls();
    updateNeed();
  })();

  async function boot() {
    if (!st.token) return view("landing");
    try {
      const me = await api("me");
      st.user = me.user;
      const { submission } = await api("submission");
      st.submission = submission;
      if (submission) {
        await fillFromSubmission(submission);
        $("#submitBtn").textContent = "Save changes";
      } else if (!$("#fName").value) {
        $("#fName").value = me.user.name;
      }
      openMine();
    } catch {
      logout();
    }
  }

  G.loadFonts().then(() => { redraw(); samplesDrawn = false; if (!$("#landing").classList.contains("hidden")) drawSamples(); });
  boot();
})();
