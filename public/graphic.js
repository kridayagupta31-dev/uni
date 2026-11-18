// Draws the 1080 x 1350 commit graphic. Shared by the student page, the landing samples and admin.
(() => {
  const W = 1080, H = 1350;
  const CARD = { x: 84, y: 78, w: 912, h: 1188 };
  const PHOTO = { x: 128, y: 196, w: 824, h: 836 };
  const F = {
    name: '"Alfa Slab One", "Rockwell", Georgia, serif',
    serif: '"Libre Caslon Text", "Baskerville", Georgia, serif',
    varsity: '"Graduate", "Alfa Slab One", Georgia, serif',
  };

  async function loadFonts() {
    if (!document.fonts) return;
    await Promise.all([
      document.fonts.load(`80px ${F.name}`),
      document.fonts.load(`700 40px ${F.serif}`),
      document.fonts.load(`400 40px ${F.serif}`),
      document.fonts.load(`30px ${F.varsity}`),
    ]).catch(() => {});
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => res(img);
      img.onerror = () => rej(new Error(`Could not load ${src}`));
      img.src = src;
    });
  }

  const rng = (seed) => {
    let t = seed >>> 0 || 1;
    return () => {
      t ^= t << 13; t ^= t >>> 17; t ^= t << 5;
      return (t >>> 0) % 1e5 / 1e5;
    };
  };
  const hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  // t < 0 darkens, t > 0 lightens
  const shade = (h, t) => {
    const { r, g, b } = hex(h);
    const f = (v) => Math.max(0, Math.min(255, Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t)));
    return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
  };
  const alpha = (h, a) => {
    const { r, g, b } = hex(h);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };
  const lum = (h) => {
    const { r, g, b } = hex(h);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  function cover(c, img, x, y, w, h, tr = { zoom: 1, x: 0, y: 0 }) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * tr.zoom;
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const ox = (dw - w) / 2, oy = (dh - h) / 2;
    c.drawImage(img, x - ox - tr.x * ox, y - oy - tr.y * oy, dw, dh);
  }
  function contain(c, img, x, y, w, h) {
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    c.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function fit(c, text, family, weight, maxW, size, min, spacing = 0) {
    for (; size > min; size -= 2) {
      c.font = `${weight} ${size}px ${family}`;
      if (c.measureText(text).width + spacing * size * Math.max(0, text.length - 1) <= maxW) break;
    }
    c.font = `${weight} ${size}px ${family}`;
    return size;
  }
  function spaced(c, text, x, y, sp) {
    if ("letterSpacing" in c) {
      c.letterSpacing = `${sp}px`;
      c.textAlign = "center";
      c.fillText(text, x + sp / 2, y);
      c.letterSpacing = "0px";
      return;
    }
    const chars = [...text];
    const ws = chars.map((ch) => c.measureText(ch).width);
    let cx = x - (ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1)) / 2;
    c.textAlign = "left";
    chars.forEach((ch, i) => { c.fillText(ch, cx, y); cx += ws[i] + sp; });
    c.textAlign = "center";
  }
  function wrap(c, text, maxW, maxLines) {
    const words = text.split(/\s+/);
    if (c.measureText(text).width <= maxW) return [text];
    // most even 2-line split first
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
      const m = Math.max(c.measureText(a).width, c.measureText(b).width);
      if (m <= maxW && (!best || m < best.m)) best = { m, lines: [a, b] };
    }
    if (best) return best.lines;
    const lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines.length > maxLines || lines.some((l) => c.measureText(l).width > maxW) ? null : lines;
  }

  function backdrop(c, d) {
    const { primary, backdrop: photos, seed } = d;
    const r = rng(seed);
    c.fillStyle = shade(primary, -0.45);
    c.fillRect(0, 0, W, H);
    if (!photos.length) {
      c.save();
      c.translate(W / 2, H / 2);
      c.rotate(-Math.PI / 7);
      for (let i = -16; i < 16; i++) {
        c.fillStyle = i % 2 === 0 ? shade(primary, -0.25) : shade(primary, -0.38);
        c.fillRect(i * 90, -1200, 90, 2400);
      }
      c.restore();
      c.fillStyle = alpha(d.accent, 0.08);
      c.font = `150px ${F.varsity}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      const yr = window.SITE?.shortYear || "’27";
      for (let i = 0; i < 8; i++) c.fillText(`${yr} ${yr} ${yr}`, W / 2 + (i % 2) * 120, i * 190);
      return;
    }
    const tw = W / 3, th = H / 4;
    const order = photos.map((img) => ({ img, k: r() })).sort((a, b) => a.k - b.k);
    let k = 0;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const img = order[k++ % order.length].img;
        const w = tw * (1.18 + r() * 0.25), h = th * (1.15 + r() * 0.25);
        const x = col * tw + tw / 2 + (r() - 0.5) * 50, y = row * th + th / 2 + (r() - 0.5) * 50;
        c.save();
        c.translate(x, y);
        c.rotate((r() - 0.5) * 0.12);
        c.shadowColor = "rgba(0,0,0,0.45)";
        c.shadowBlur = 24;
        c.fillStyle = "#fff";
        c.fillRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12);
        c.shadowColor = "transparent";
        c.beginPath();
        c.rect(-w / 2, -h / 2, w, h);
        c.clip();
        cover(c, img, -w / 2, -h / 2, w, h);
        c.restore();
      }
    }
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, alpha(primary, 0.28));
    g.addColorStop(0.5, alpha(primary, 0.12));
    g.addColorStop(1, alpha(primary, 0.32));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  function card(c, d) {
    const { x, y, w, h } = CARD;
    c.save();
    c.shadowColor = "rgba(0,0,0,0.55)";
    c.shadowBlur = 50;
    c.shadowOffsetY = 18;
    c.fillStyle = d.primary;
    c.fillRect(x, y, w, h);
    c.restore();
    const g = c.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "rgba(255,255,255,0.10)");
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(0,0,0,0.18)");
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
    c.strokeStyle = alpha(d.accent, 0.55);
    c.lineWidth = 3;
    c.strokeRect(x + 14, y + 14, w - 28, h - 28);
  }

  function name(c, d) {
    const text = (d.name || "YOUR NAME").toUpperCase();
    const y = CARD.y + 62;
    fit(c, text, F.name, "400", CARD.w - 90, 76, 34, 0.02);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "rgba(0,0,0,0.35)";
    spaced(c, text, W / 2 + 3, y + 4, 2);
    c.fillStyle = d.accent;
    spaced(c, text, W / 2, y, 2);
  }

  function photo(c, d) {
    const { x, y, w, h } = PHOTO;
    c.fillStyle = "#f7f1e6";
    c.fillRect(x - 8, y - 8, w + 16, h + 16);
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    if (d.baby) {
      cover(c, d.baby, x, y, w, h, d.transform);
    } else {
      const g = c.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, shade(d.primary, 0.75));
      g.addColorStop(1, shade(d.primary, 0.55));
      c.fillStyle = g;
      c.fillRect(x, y, w, h);
      c.fillStyle = shade(d.primary, 0.2);
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = `120px ${F.varsity}`;
      c.fillText("👶", x + w / 2, y + h / 2 - 70);
      c.font = `700 34px ${F.serif}`;
      c.fillText("Your baby photo goes here", x + w / 2, y + h / 2 + 50);
    }
    const v = c.createRadialGradient(x + w / 2, y + h / 2, w * 0.35, x + w / 2, y + h / 2, w * 0.78);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.22)");
    c.fillStyle = v;
    c.fillRect(x, y, w, h);
    c.restore();

    if (d.seal) {
      const cx = x + w - 84, cy = y + 84;
      c.save();
      c.shadowColor = "rgba(0,0,0,0.35)";
      c.shadowBlur = 14;
      c.beginPath();
      c.arc(cx, cy, 58, 0, Math.PI * 2);
      c.fillStyle = "#fffaf0";
      c.fill();
      c.restore();
      c.lineWidth = 4;
      c.strokeStyle = d.accent;
      c.beginPath();
      c.arc(cx, cy, 56, 0, Math.PI * 2);
      c.stroke();
      c.save();
      c.beginPath();
      c.arc(cx, cy, 50, 0, Math.PI * 2);
      c.clip();
      contain(c, d.seal, cx - 48, cy - 48, 96, 96);
      c.restore();
    }
  }

  function tornPath(c, x, y, w, h, seed) {
    const r = rng(seed * 7 + 3);
    c.beginPath();
    c.moveTo(x, y + r() * 6);
    for (let i = x + 14; i <= x + w; i += 14) c.lineTo(i, y + r() * 9 - 2);
    for (let i = y + 14; i <= y + h; i += 14) c.lineTo(x + w + r() * 6 - 3, i);
    for (let i = x + w - 14; i >= x; i -= 14) c.lineTo(i, y + h - r() * 9 + 2);
    for (let i = y + h - 14; i >= y; i -= 14) c.lineTo(x + r() * 6 - 3, i);
    c.closePath();
  }

  function label(c, d) {
    const top = PHOTO.y + PHOTO.h - 96;
    const LX = 210, LW = 660, LH = 158;
    c.save();
    c.translate(W / 2, top + 79);
    c.rotate(-0.012);
    c.translate(-W / 2, -(top + 79));
    c.save();
    c.shadowColor = "rgba(0,0,0,0.4)";
    c.shadowBlur = 22;
    c.shadowOffsetY = 8;
    tornPath(c, LX, top, LW, LH, d.seed);
    c.fillStyle = "#fffdf7";
    c.fill();
    c.restore();
    c.save();
    tornPath(c, LX, top, LW, LH, d.seed);
    c.clip();
    c.fillStyle = "rgba(120, 100, 70, 0.05)";
    for (let i = 0; i < 9; i++) c.fillRect(LX, top + 10 + i * 17, LW, 1);
    c.restore();

    if (d.badgeStyle === "wordmark" && d.wordmark) {
      contain(c, d.wordmark, LX + 30, top + 18, LW - 60, LH - 36);
    } else {
      let tx = LX + 30, tw = LW - 60;
      if (d.seal) {
        contain(c, d.seal, LX + 30, top + 20, 118, 118);
        tx += 140;
        tw -= 140;
      }
      const text = d.university || "Your University";
      c.fillStyle = lum(d.primary) < 0.35 ? d.primary : "#1d1d1f";
      c.textAlign = "left";
      c.textBaseline = "middle";
      let lines = null, size = 46;
      for (; size >= 22; size -= 2) {
        c.font = `400 ${size}px ${F.serif}`;
        lines = wrap(c, text, tw, size > 34 ? 2 : 3);
        if (lines && lines.length * size * 1.08 <= 124) break;
      }
      lines = lines || [text];
      const lh = size * 1.08;
      const sy = top + 79 - ((lines.length - 1) * lh) / 2;
      lines.forEach((l, i) => c.fillText(l, tx, sy + i * lh));
    }
    c.restore();
  }

  function subject(c, d) {
    const text = (d.subject || "YOUR MAJOR").toUpperCase();
    const y = CARD.y + CARD.h - 84;
    fit(c, text, F.serif, "700", CARD.w - 120, 42, 22, 0.12);
    c.textBaseline = "middle";
    c.fillStyle = d.accent;
    spaced(c, text, W / 2, y, 4);
  }

  function footer(c, d) {
    if (!d.footer) return;
    const y = CARD.y + CARD.h + 42;
    c.font = `26px ${F.varsity}`;
    c.textBaseline = "middle";
    c.fillStyle = "rgba(0,0,0,0.55)";
    spaced(c, d.footer, W / 2 + 2, y + 2, 6);
    c.fillStyle = "#fffaf0";
    spaced(c, d.footer, W / 2, y, 6);
  }

  function render(canvas, d) {
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext("2d");
    c.imageSmoothingQuality = "high";
    const data = {
      primary: "#7A1F2B", accent: "#F2C14E", backdrop: [], transform: { zoom: 1, x: 0, y: 0 },
      badgeStyle: "seal", seed: 1, ...d,
    };
    backdrop(c, data);
    card(c, data);
    name(c, data);
    photo(c, data);
    label(c, data);
    subject(c, data);
    footer(c, data);
  }

  // Pick a frame colour from the seal when the school isn't in the list below.
  function colorsFromImage(img) {
    try {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 48;
      const c = cv.getContext("2d", { willReadFrequently: true });
      c.drawImage(img, 0, 0, 48, 48);
      const { data } = c.getImageData(0, 0, 48, 48);
      const buckets = new Map();
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        if (a < 200) continue;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if ((max > 235 && min > 215) || (max - min < 28 && max > 60)) continue;
        const k = `${r >> 5}-${g >> 5}-${b >> 5}`;
        const e = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
        e.n++; e.r += r; e.g += g; e.b += b;
        buckets.set(k, e);
      }
      const top = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
      if (!top || top.n < 20) return null;
      const h2 = (v) => Math.round(v / top.n).toString(16).padStart(2, "0");
      const primary = `#${h2(top.r)}${h2(top.g)}${h2(top.b)}`.toUpperCase();
      return { primary, accent: lum(primary) > 0.45 ? "#1D1D1F" : "#F2C14E" };
    } catch {
      return null;
    }
  }

  // Schools with known colours. Any other school still works: colours come from its seal.
  const UNIS = [
    ["Arizona State University", "Arizona_State_University", "#8C1D40", "#FFC627", "asu"],
    ["Boston College", "Boston_College", "#8A100B", "#DBCCA0", "bc"],
    ["Boston University", "Boston_University", "#CC0000", "#FFFFFF", "bu"],
    ["Brandeis University", "Brandeis_University", "#003478", "#FFFFFF"],
    ["Brown University", "Brown_University", "#4E3629", "#ED1C24"],
    ["California Institute of Technology", "California_Institute_of_Technology", "#FF6C0C", "#FFFFFF", "caltech"],
    ["Carnegie Mellon University", "Carnegie_Mellon_University", "#C41230", "#FFFFFF", "cmu"],
    ["Case Western Reserve University", "Case_Western_Reserve_University", "#0A304E", "#FFFFFF", "cwru"],
    ["Clemson University", "Clemson_University", "#F56600", "#522D80"],
    ["Columbia University", "Columbia_University", "#1D4F91", "#B9D9EB"],
    ["Cornell University", "Cornell_University", "#B31B1B", "#FFFFFF"],
    ["Dartmouth College", "Dartmouth_College", "#00693E", "#FFFFFF"],
    ["Drexel University", "Drexel_University", "#07294D", "#FFC600"],
    ["Duke University", "Duke_University", "#012169", "#FFFFFF"],
    ["Emory University", "Emory_University", "#012169", "#F2A900"],
    ["Florida State University", "Florida_State_University", "#782F40", "#CEB888", "fsu"],
    ["George Washington University", "George_Washington_University", "#033C5A", "#AA9868", "gwu"],
    ["Georgetown University", "Georgetown_University", "#041E42", "#8D817B"],
    ["Georgia Institute of Technology", "Georgia_Tech", "#003057", "#B3A369", "georgia tech gatech"],
    ["Harvard University", "Harvard_University", "#A51C30", "#FFFFFF"],
    ["Indiana University Bloomington", "Indiana_University_Bloomington", "#990000", "#EEEDEB", "iu kelley"],
    ["Johns Hopkins University", "Johns_Hopkins_University", "#002D72", "#68ACE5", "jhu"],
    ["Lehigh University", "Lehigh_University", "#653600", "#FFFFFF"],
    ["Massachusetts Institute of Technology", "Massachusetts_Institute_of_Technology", "#750014", "#FFFFFF", "mit"],
    ["Michigan State University", "Michigan_State_University", "#18453B", "#FFFFFF", "msu"],
    ["New York University", "New_York_University", "#57068C", "#F7C948", "nyu stern"],
    ["North Carolina State University", "North_Carolina_State_University", "#CC0000", "#FFFFFF", "nc state ncsu"],
    ["Northeastern University", "Northeastern_University", "#C8102E", "#F2C14E", "neu"],
    ["Northwestern University", "Northwestern_University", "#4E2A84", "#FFFFFF"],
    ["Ohio State University", "Ohio_State_University", "#BB0000", "#E5E5E5", "osu"],
    ["Pennsylvania State University", "Pennsylvania_State_University", "#041E42", "#FFFFFF", "penn state psu"],
    ["Princeton University", "Princeton_University", "#E77500", "#121212"],
    ["Purdue University", "Purdue_University", "#000000", "#CFB991"],
    ["Rensselaer Polytechnic Institute", "Rensselaer_Polytechnic_Institute", "#D6001C", "#FFFFFF", "rpi"],
    ["Rice University", "Rice_University", "#00205B", "#C1C6C8"],
    ["Rochester Institute of Technology", "Rochester_Institute_of_Technology", "#F76902", "#FFFFFF", "rit"],
    ["Rutgers University–New Brunswick", "Rutgers_University–New_Brunswick", "#CC0033", "#FFFFFF", "rutgers"],
    ["Santa Clara University", "Santa_Clara_University", "#862633", "#FFFFFF", "scu"],
    ["Stanford University", "Stanford_University", "#8C1515", "#FFFFFF"],
    ["Stony Brook University", "Stony_Brook_University", "#990000", "#FFFFFF"],
    ["Syracuse University", "Syracuse_University", "#F76900", "#000E54", "cuse"],
    ["Texas A&M University", "Texas_A&M_University", "#500000", "#FFFFFF", "tamu"],
    ["Tufts University", "Tufts_University", "#3E8EDE", "#FFFFFF"],
    ["Tulane University", "Tulane_University", "#006747", "#71C5E8"],
    ["University of Arizona", "University_of_Arizona", "#AB0520", "#FFFFFF"],
    ["University at Buffalo", "University_at_Buffalo", "#005BBB", "#FFFFFF", "suny buffalo ub"],
    ["University of California, Berkeley", "University_of_California,_Berkeley", "#002676", "#FDB515", "uc berkeley cal"],
    ["University of California, Davis", "University_of_California,_Davis", "#022851", "#FFBF00", "uc davis ucd"],
    ["University of California, Irvine", "University_of_California,_Irvine", "#0064A4", "#FFD200", "uc irvine uci"],
    ["University of California, Los Angeles", "University_of_California,_Los_Angeles", "#2774AE", "#FFD100", "ucla"],
    ["University of California, San Diego", "University_of_California,_San_Diego", "#182B49", "#F2C14E", "uc san diego ucsd"],
    ["University of California, Santa Barbara", "University_of_California,_Santa_Barbara", "#003660", "#FEBC11", "uc santa barbara ucsb"],
    ["University of California, Santa Cruz", "University_of_California,_Santa_Cruz", "#003C6C", "#FDC700", "uc santa cruz ucsc"],
    ["University of Chicago", "University_of_Chicago", "#800000", "#FFFFFF", "uchicago"],
    ["University of Colorado Boulder", "University_of_Colorado_Boulder", "#000000", "#CFB87C", "cu boulder"],
    ["University of Connecticut", "University_of_Connecticut", "#000E2F", "#FFFFFF", "uconn"],
    ["University of Florida", "University_of_Florida", "#0021A5", "#FA4616", "uf"],
    ["University of Georgia", "University_of_Georgia", "#BA0C2F", "#FFFFFF", "uga"],
    ["University of Illinois Urbana-Champaign", "University_of_Illinois_Urbana-Champaign", "#13294B", "#FF5F05", "uiuc illinois"],
    ["University of Maryland, College Park", "University_of_Maryland,_College_Park", "#E21833", "#FFD200", "umd"],
    ["University of Massachusetts Amherst", "University_of_Massachusetts_Amherst", "#881C1C", "#F2C14E", "umass"],
    ["University of Miami", "University_of_Miami", "#005030", "#F47321", "um"],
    ["University of Michigan", "University_of_Michigan", "#00274C", "#FFCB05", "umich ross"],
    ["University of Minnesota", "University_of_Minnesota", "#7A0019", "#FFCC33", "umn"],
    ["University of North Carolina at Chapel Hill", "University_of_North_Carolina_at_Chapel_Hill", "#13294B", "#7BAFD4", "unc"],
    ["University of Notre Dame", "University_of_Notre_Dame", "#0C2340", "#C99700", "notre dame"],
    ["University of Pennsylvania", "University_of_Pennsylvania", "#011F5B", "#FFFFFF", "upenn penn wharton"],
    ["University of Pittsburgh", "University_of_Pittsburgh", "#003594", "#FFB81C", "pitt"],
    ["University of Rochester", "University_of_Rochester", "#001E5F", "#FFD82B"],
    ["University of Southern California", "University_of_Southern_California", "#990000", "#FFCC00", "usc"],
    ["University of Texas at Austin", "University_of_Texas_at_Austin", "#BF5700", "#FFFFFF", "ut austin"],
    ["University of Texas at Dallas", "University_of_Texas_at_Dallas", "#154734", "#E87500", "utd"],
    ["University of Virginia", "University_of_Virginia", "#232D4B", "#E57200", "uva"],
    ["University of Washington", "University_of_Washington", "#4B2E83", "#B7A57A", "uw"],
    ["University of Wisconsin–Madison", "University_of_Wisconsin–Madison", "#C5050C", "#FFFFFF", "uw madison wisconsin"],
    ["Vanderbilt University", "Vanderbilt_University", "#000000", "#CFAE70"],
    ["Villanova University", "Villanova_University", "#00205B", "#FFFFFF"],
    ["Virginia Tech", "Virginia_Tech", "#630031", "#CF4420", "vt"],
    ["Washington University in St. Louis", "Washington_University_in_St._Louis", "#A51417", "#FFFFFF", "washu wustl"],
    ["Worcester Polytechnic Institute", "Worcester_Polytechnic_Institute", "#AC2B37", "#FFFFFF", "wpi"],
    ["Yale University", "Yale_University", "#00356B", "#FFFFFF"],
    ["McGill University", "McGill_University", "#ED1B2F", "#FFFFFF"],
    ["University of British Columbia", "University_of_British_Columbia", "#002145", "#F2C14E", "ubc"],
    ["University of Toronto", "University_of_Toronto", "#1E3765", "#FFFFFF", "uoft"],
    ["University of Waterloo", "University_of_Waterloo", "#000000", "#FED34C", "uwaterloo"],
    ["Imperial College London", "Imperial_College_London", "#0000CD", "#FFFFFF", "icl"],
    ["King's College London", "King's_College_London", "#C8102E", "#FFFFFF", "kcl"],
    ["London School of Economics", "London_School_of_Economics", "#A6192E", "#FFFFFF", "lse"],
    ["University College London", "University_College_London", "#500778", "#FFFFFF", "ucl"],
    ["University of Cambridge", "University_of_Cambridge", "#85B09A", "#FFFFFF"],
    ["University of Edinburgh", "University_of_Edinburgh", "#041E42", "#FFFFFF"],
    ["University of Oxford", "University_of_Oxford", "#002147", "#FFFFFF"],
    ["University of St Andrews", "University_of_St_Andrews", "#00539B", "#FFFFFF"],
    ["University of Warwick", "University_of_Warwick", "#3C1053", "#FFFFFF", "wbs"],
    ["Ashoka University", "Ashoka_University", "#7A1F2B", "#FFFFFF"],
    ["National University of Singapore", "National_University_of_Singapore", "#003D7C", "#EF7C00", "nus"],
    ["University of Hong Kong", "University_of_Hong_Kong", "#005C35", "#FFFFFF", "hku"],
    ["University of Melbourne", "University_of_Melbourne", "#094183", "#FFFFFF"],
    ["University of Sydney", "University_of_Sydney", "#E64626", "#FFFFFF", "usyd"],
  ].map(([name, wiki, primary, accent, aliases]) => ({ name, wiki, primary, accent, aliases }));

  function searchLocal(q, n = 6) {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const words = s.split(/\s+/);
    return UNIS.map((u) => {
      const hay = `${u.name} ${u.aliases || ""}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return null;
      const score = ((u.aliases || "").split(" ").includes(s) ? 0 : 10) + (u.name.toLowerCase().startsWith(s) ? 0 : 5) + u.name.length / 100;
      return { u, score };
    })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)
      .slice(0, n)
      .map((x) => x.u);
  }

  // Load a school's seal, logo and campus photos (through our image proxy so export works).
  const assetCache = new Map();
  const proxied = (u) => `/api/img?u=${encodeURIComponent(u)}`;
  function loadAssets(wiki) {
    if (!wiki) return Promise.resolve({ seal: null, wordmark: null, photos: [] });
    if (assetCache.has(wiki)) return assetCache.get(wiki);
    const soft = (p) => p.catch(() => null);
    const p = (async () => {
      const r = await fetch(`/api/universities/assets?title=${encodeURIComponent(wiki)}`);
      const a = r.ok ? await r.json() : { seal: null, wordmark: null, photos: [] };
      const [seal, wordmark, ...photos] = await Promise.all([
        a.seal ? soft(loadImage(proxied(a.seal))) : null,
        a.wordmark ? soft(loadImage(proxied(a.wordmark))) : null,
        ...(a.photos || []).slice(0, 8).map((u) => soft(loadImage(proxied(u)))),
      ]);
      return { seal, wordmark, photos: photos.filter((i) => i && i.naturalWidth >= 300) };
    })();
    p.catch(() => assetCache.delete(wiki));
    assetCache.set(wiki, p);
    return p;
  }

  window.Graphic = { W, H, PHOTO, render, loadFonts, loadImage, loadAssets, colorsFromImage, UNIS, searchLocal };
})();
