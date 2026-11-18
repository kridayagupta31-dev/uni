// Backend for the Batch of 2027 commits site. One Netlify Function, storage in Netlify Blobs.
//
// Environment variables (Netlify > Site configuration > Environment variables):
//   ALLOWED_DOMAIN   school email domain without @, e.g. myschool.com
//   SESSION_SECRET   long random string used to sign logins
//   ADMIN_EMAILS     comma-separated emails allowed into the admin page
//   ADMIN_CODE       the admin access code, asked for on the admin login

import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
import SETTINGS from "./settings.mjs";

export const config = { path: "/api/*" };

const UA = "Batch2027Commits/1.0 (student graduation graphics)";
const DAY = 864e5;

// ---------------- helpers ----------------
const env = (k) => {
  try {
    const v = globalThis.Netlify?.env?.get(k);
    if (v) return v;
  } catch {}
  return process.env[k] || SETTINGS[k];
};

class HttpError extends Error {
  constructor(msg, status = 400) {
    super(msg);
    this.status = status;
  }
}
const fail = (msg, status = 400) => {
  throw new HttpError(msg, status);
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const store = (name) => getStore({ name, consistency: "strong" });
const users = () => store("users");
const subs = () => store("submissions");
const files = () => store("files");
const cache = () => getStore({ name: "uni-cache" });

const idFor = (email) => email.toLowerCase().replace(/[^a-z0-9]+/g, "_");
const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const cleanId = (v) => String(v || "").replace(/[^a-z0-9_]/g, "");
const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(String(v || ""));

function secret() {
  const s = env("SESSION_SECRET");
  if (!s || s.length < 16) fail("Server not set up yet (SESSION_SECRET missing).", 500);
  return s;
}
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const want = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (!safeEqual(mac, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}
function tokenFrom(req, url) {
  const h = req.headers.get("authorization") || "";
  return h.replace(/^Bearer\s+/i, "") || url.searchParams.get("t") || "";
}
async function requireUser(req, url) {
  const p = verify(tokenFrom(req, url));
  if (!p || p.kind !== "user") fail("Please log in again.", 401);
  const u = await users().get(idFor(p.e), { type: "json" });
  if (!u) fail("Account not found. Please sign up again.", 401);
  return u;
}
function adminEmails() {
  return (env("ADMIN_EMAILS") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
function requireAdmin(req, url) {
  const p = verify(tokenFrom(req, url));
  if (!p || p.kind !== "admin" || !adminEmails().includes(p.e)) fail("Admins only. Log in on the admin page.", 401);
  return p.e;
}
const hashPassword = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");

function parseDataUrl(s, maxBytes) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ""));
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > maxBytes) fail("That image is too big. Try a smaller photo.", 413);
  return { buf, type: `image/${m[1]}` };
}

function fileResponse(f, download) {
  const headers = { "content-type": f.metadata?.type || "image/jpeg", "cache-control": "private, max-age=60" };
  if (download) headers["content-disposition"] = `attachment; filename="${download.replace(/[^a-zA-Z0-9._-]/g, "-")}"`;
  return new Response(f.data, { headers });
}

const publicSub = (s) => s && { ...s };

// ---------------- Wikipedia ----------------
async function wget(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

const SEAL_RE = /(seal|crest|coat[ _]of[ _]arms|emblem|shield|insignia|escutcheon)/i;
const WORDMARK_RE = /(wordmark|logo|logotype|lockup|signature[ _]logo)/i;
const SKIP_RE = /(flag|map|locator|location|chart|graph|diagram|portrait|headshot|commons-logo|wiki|question_book|edit-clear|ambox|symbol_support|athletic|sports|mascot|football|basketball|team)/i;

function sized(src, width) {
  let u = src.startsWith("//") ? `https:${src}` : src;
  if (/\/thumb\//.test(u)) u = u.replace(/\/\d+px-/, `/${width}px-`);
  return u;
}

async function searchUniversities(q) {
  const data = await wget(
    `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      q
    )}&gsrlimit=10&prop=description&format=json&formatversion=2`
  );
  const pages = (data?.query?.pages || []).sort((a, b) => a.index - b.index);
  const isSchool = (p) =>
    /(universit|college|institut|school|academy|polytechnic)/i.test(`${p.title} ${p.description || ""}`) &&
    !/(list of|disambiguation|athletics|sports|football|basketball|hospital|press|library)/i.test(
      `${p.title} ${p.description || ""}`
    );
  return pages
    .filter(isSchool)
    .slice(0, 6)
    .map((p) => ({ title: p.title, description: p.description || "" }));
}

async function universityAssets(title) {
  const t = encodeURIComponent(title.replace(/ /g, "_"));
  const [summary, media] = await Promise.all([
    wget(`https://en.wikipedia.org/api/rest_v1/page/summary/${t}`).catch(() => null),
    wget(`https://en.wikipedia.org/api/rest_v1/page/media-list/${t}`).catch(() => null),
  ]);
  let seal = null;
  let wordmark = null;
  const photos = [];
  const seen = new Set();

  for (const item of media?.items || []) {
    if (item.type !== "image" || !item.srcset?.length) continue;
    const file = item.title || "";
    if (SKIP_RE.test(file)) continue;
    const src = item.srcset[item.srcset.length - 1].src;
    const base = file.toLowerCase();
    if (seen.has(base)) continue;
    seen.add(base);
    if (SEAL_RE.test(file)) {
      if (!seal) seal = sized(src, 500);
    } else if (WORDMARK_RE.test(file)) {
      if (!wordmark) wordmark = sized(src, 960);
    } else if (/\.(jpe?g)$/i.test(file) && photos.length < 10) {
      photos.push(sized(src, 960));
    }
  }

  // The infobox image is usually the seal or logo.
  const lead = summary?.originalimage?.source || summary?.thumbnail?.source;
  if (lead) {
    const isPhoto = /\.jpe?g/i.test(lead) && !SEAL_RE.test(lead) && !WORDMARK_RE.test(lead);
    if (isPhoto) {
      if (!photos.some((p) => p.split("/").pop() === lead.split("/").pop())) photos.unshift(sized(lead, 960));
    } else if (!seal) {
      seal = sized(lead, 500);
    } else if (!wordmark && WORDMARK_RE.test(lead)) {
      wordmark = sized(lead, 960);
    }
  }
  return { title: summary?.title || title, seal, wordmark, photos };
}

async function cached(key, fn) {
  const c = await cache().get(key, { type: "json" }).catch(() => null);
  if (c && Date.now() - c.t < 7 * DAY) return c.data;
  const data = await fn();
  await cache().setJSON(key, { t: Date.now(), data }).catch(() => {});
  return data;
}

// ---------------- routes ----------------
async function route(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const parts = path.split("/");
  const method = req.method.toUpperCase();
  const body = async () => (method === "GET" ? {} : await req.json().catch(() => ({})));

  // ----- student accounts -----
  if (method === "POST" && path === "signup") {
    const b = await body();
    const email = clean(b.email, 120).toLowerCase();
    const domain = (env("ALLOWED_DOMAIN") || "").toLowerCase().replace(/^@/, "").trim();
    if (!domain) fail("Server not set up yet (ALLOWED_DOMAIN missing).", 500);
    if (!/^[^\s@]+@[^\s@]+$/.test(email) || !email.endsWith(`@${domain}`))
      fail("That isn't a school email. Use your school email address.");
    const name = clean(b.fullName, 80);
    if (!name) fail("Enter your full name.");
    const pw = String(b.password || "");
    if (pw.length < 8) fail("Password needs at least 8 characters.");
    const id = idFor(email);
    if (await users().get(id)) fail("You already have an account. Log in instead.", 409);
    const salt = crypto.randomBytes(16).toString("hex");
    const user = { id, email, name, salt, hash: hashPassword(pw, salt), createdAt: new Date().toISOString() };
    await users().setJSON(id, user);
    return json({ token: sign({ kind: "user", e: email, exp: Date.now() + 30 * DAY }), user: { email, name } });
  }

  if (method === "POST" && path === "login") {
    const b = await body();
    const email = clean(b.email, 120).toLowerCase();
    const u = await users().get(idFor(email), { type: "json" });
    if (!u || !safeEqual(hashPassword(String(b.password || ""), u.salt), u.hash))
      fail("Email or password is wrong.", 401);
    return json({
      token: sign({ kind: "user", e: u.email, exp: Date.now() + 30 * DAY }),
      user: { email: u.email, name: u.name },
    });
  }

  if (method === "GET" && path === "me") {
    const u = await requireUser(req, url);
    return json({ user: { email: u.email, name: u.name } });
  }

  if (path === "submission") {
    const u = await requireUser(req, url);
    const id = idFor(u.email);
    const prev = await subs().get(id, { type: "json" });
    if (method === "GET") return json({ submission: publicSub(prev) });

    if (method === "POST") {
      if (prev?.status === "posted") fail("You're already posted, so this can't be changed. Message the page if something's wrong.", 409);
      const b = await body();
      const fullName = clean(b.fullName, 60);
      const university = clean(b.university, 140);
      const subject = clean(b.subject, 60);
      if (!fullName || !university || !subject) fail("Name, university and subject are all needed.");
      if (b.consent !== true) fail("Tick the consent box so we're allowed to post your graphic.");
      const graphic = parseDataUrl(b.graphic, 4e6);
      if (!graphic) fail("The graphic didn't come through. Try again.");
      const baby = parseDataUrl(b.babyPhoto, 3e6);
      if (!baby && !prev) fail("Add a baby photo.");

      await files().set(`graphic/${id}`, graphic.buf, { metadata: { type: graphic.type } });
      if (baby) await files().set(`baby/${id}`, baby.buf, { metadata: { type: baby.type } });

      const now = new Date().toISOString();
      const record = {
        id,
        email: u.email,
        accountName: u.name,
        fullName,
        university,
        universityWiki: clean(b.universityWiki, 160) || null,
        subject,
        primaryColor: isHex(b.primaryColor) ? b.primaryColor : "#7A1F2B",
        accentColor: isHex(b.accentColor) ? b.accentColor : "#F2C14E",
        badgeStyle: b.badgeStyle === "wordmark" ? "wordmark" : "seal",
        consent: true,
        consentAt: now,
        status: "pending",
        createdAt: prev?.createdAt || now,
        updatedAt: now,
      };
      await subs().setJSON(id, record);
      return json({ submission: record });
    }
  }

  if (method === "GET" && parts[0] === "mine" && ["graphic", "baby"].includes(parts[1])) {
    const u = await requireUser(req, url);
    const f = await files().getWithMetadata(`${parts[1]}/${idFor(u.email)}`, { type: "arrayBuffer" });
    if (!f) fail("Not found", 404);
    return fileResponse(f, url.searchParams.get("download"));
  }

  // ----- university lookup -----
  if (method === "GET" && path === "universities/search") {
    const q = clean(url.searchParams.get("q"), 100);
    if (q.length < 3) return json({ results: [] });
    try {
      return json({ results: await cached(`s:${q.toLowerCase()}`, () => searchUniversities(q)) });
    } catch (e) {
      console.error(e);
      return json({ results: [] });
    }
  }

  if (method === "GET" && path === "universities/assets") {
    const title = clean(url.searchParams.get("title"), 160);
    if (!title) fail("Missing title");
    try {
      return json(await cached(`a:${title.toLowerCase()}`, () => universityAssets(title)));
    } catch (e) {
      console.error(e);
      return json({ title, seal: null, wordmark: null, photos: [] });
    }
  }

  // Same-origin copy of Wikimedia images so the canvas can be exported.
  if (method === "GET" && path === "img") {
    const raw = url.searchParams.get("u") || "";
    let target;
    try {
      target = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    } catch {}
    if (!target || target.protocol !== "https:" || target.hostname !== "upload.wikimedia.org") fail("Not allowed", 403);
    const r = await fetch(target, { headers: { "User-Agent": UA } });
    const ct = r.headers.get("content-type") || "";
    if (!r.ok || !ct.startsWith("image/")) fail("Image fetch failed", 502);
    return new Response(r.body, {
      headers: {
        "content-type": ct,
        "cache-control": "public, max-age=604800",
        "netlify-cdn-cache-control": "public, max-age=2592000",
      },
    });
  }

  // ----- admin -----
  if (parts[0] === "admin") {
    if (method === "POST" && parts[1] === "login") {
      const b = await body();
      const email = clean(b.email, 120).toLowerCase();
      const code = String(b.code || "");
      const want = env("ADMIN_CODE");
      if (!want || !adminEmails().length) fail("Admin login isn't set up yet (ADMIN_EMAILS / ADMIN_CODE).", 500);
      if (!adminEmails().includes(email) || !safeEqual(code, want)) fail("Wrong admin email or code.", 401);
      return json({ token: sign({ kind: "admin", e: email, exp: Date.now() + 12 * 3600e3 }), email });
    }

    const admin = requireAdmin(req, url);

    if (method === "GET" && parts[1] === "me") return json({ email: admin });

    if (method === "GET" && parts[1] === "submissions" && !parts[2]) {
      const { blobs } = await subs().list();
      const list = (await Promise.all(blobs.map((b) => subs().get(b.key, { type: "json" })))).filter(Boolean);
      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return json({ submissions: list });
    }

    if (parts[1] === "submissions" && parts[2]) {
      const id = cleanId(parts[2]);
      if (method === "PATCH") {
        const b = await body();
        const s = await subs().get(id, { type: "json" });
        if (!s) fail("Not found", 404);
        s.status = b.status === "posted" ? "posted" : "pending";
        s.postedAt = s.status === "posted" ? new Date().toISOString() : null;
        await subs().setJSON(id, s);
        return json({ submission: s });
      }
      if (method === "DELETE") {
        await Promise.all([subs().delete(id), files().delete(`graphic/${id}`), files().delete(`baby/${id}`)]);
        return json({ ok: true });
      }
    }

    if (method === "GET" && parts[1] === "file") {
      const id = cleanId(parts[2]);
      const type = parts[3] === "baby" ? "baby" : "graphic";
      const f = await files().getWithMetadata(`${type}/${id}`, { type: "arrayBuffer" });
      if (!f) fail("Not found", 404);
      return fileResponse(f, url.searchParams.get("download"));
    }

    if (method === "GET" && parts[1] === "export.csv") {
      const { blobs } = await subs().list();
      const list = (await Promise.all(blobs.map((b) => subs().get(b.key, { type: "json" })))).filter(Boolean);
      const cols = ["fullName", "university", "subject", "email", "status", "consent", "createdAt", "updatedAt"];
      const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = "﻿" + [cols.join(","), ...list.map((s) => cols.map((c) => q(s[c])).join(","))].join("\n");
      return new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="batch-2027-submissions.csv"',
        },
      });
    }

    if (method === "GET" && parts[1] === "accounts") {
      const [{ blobs: ub }, { blobs: sb }] = await Promise.all([users().list(), subs().list()]);
      const submitted = new Set(sb.map((b) => b.key));
      const list = (await Promise.all(ub.map((b) => users().get(b.key, { type: "json" }))))
        .filter(Boolean)
        .map((u) => ({ id: idFor(u.email), email: u.email, name: u.name, createdAt: u.createdAt, submitted: submitted.has(idFor(u.email)) }));
      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return json({ accounts: list });
    }

    if (method === "DELETE" && parts[1] === "accounts" && parts[2]) {
      await users().delete(cleanId(parts[2]));
      return json({ ok: true });
    }
  }

  fail("Not found", 404);
}

export default async (req) => {
  try {
    return await route(req);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong. Try again in a minute." }, 500);
  }
};
