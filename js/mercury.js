// Is Mercury retrograde? -- the page: the answer for a date, the loop in the
// sky, the orrery and the year's retrogrades. Positions come from astro.js.

/* global Astro */

const MIN_YEAR = 1800;
const MAX_YEAR = 2050;
const DAY = 86400000;

let current = null; // the date being answered (Date)
let focus = null; // the Mercury retrograde the charts show
let yearShown = null;
let playing = null; // animation frame id
let sliderStart = 0; // JD range of the slider
let sliderEnd = 0;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---------------------------------------------------------------- formatting

const fmtDate = (d, withYear = true) =>
  d.toLocaleDateString(undefined, withYear ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
const fmtTime = (d) => d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const fmtRange = (a, b) => (a.getFullYear() === b.getFullYear() ? `${fmtDate(a, false)} – ${fmtDate(b)}` : `${fmtDate(a)} – ${fmtDate(b)}`);

// 22°33′ Scorpio
const fmtLon = (lon) => {
  const l = Astro.norm360(lon);
  const s = Astro.signOf(l);
  const inSign = l % 30;
  let deg = Math.floor(inSign);
  let min = Math.round((inSign - deg) * 60);
  if (min === 60) {
    deg += 1;
    min = 0;
  }
  return `${deg}°${String(min).padStart(2, "0")}′ ${s.name}`;
};
const signName = (lon) => Astro.signOf(lon).name;
const signsSpan = (a, b) => (signName(a) === signName(b) ? signName(a) : `${signName(a)} and ${signName(b)}`);

const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const inDays = (n) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseIso = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return null;
  // noon, so the day doesn't flip when crossing time zones
  const d = new Date(+m[1], +m[2] - 1, +m[3], 12);
  return isNaN(d) || d.getFullYear() < MIN_YEAR || d.getFullYear() > MAX_YEAR ? null : d;
};

// ---------------------------------------------------------------- data

const cache = {};
// retrogrades of a planet overlapping a calendar year (cached)
function yearRetros(id, year) {
  const key = id + year;
  if (!cache[key]) {
    const s = Astro.jd(new Date(year, 0, 1));
    const e = Astro.jd(new Date(year + 1, 0, 1));
    cache[key] = Astro.retrogrades(id, s, e);
  }
  return cache[key];
}

// Mercury retrogrades around a date, in order
function mercuryAround(date) {
  const y = date.getFullYear();
  const list = [];
  const seen = new Set();
  for (const yy of [y - 1, y, y + 1]) {
    if (yy < MIN_YEAR - 1 || yy > MAX_YEAR + 1) continue;
    for (const r of yearRetros("mercury", yy)) {
      if (!seen.has(+r.start)) {
        seen.add(+r.start);
        list.push(r);
      }
    }
  }
  return list.sort((a, b) => a.start - b.start);
}

// where the date stands: retrograde, shadow or direct, and the period to show
function situation(date) {
  const list = mercuryAround(date);
  for (const r of list) {
    if (date >= r.start && date <= r.end) return { state: "retro", r };
    if (date >= r.preShadow && date < r.start) return { state: "pre", r };
    if (date > r.end && date <= r.postShadow) return { state: "post", r };
  }
  const next = list.find((r) => r.start > date);
  const prev = [...list].reverse().find((r) => r.end < date);
  return { state: "direct", r: next || prev, prev };
}

// ---------------------------------------------------------------- answer

function renderAnswer() {
  const date = current;
  const now = new Date();
  const isToday = startOfDay(date).getTime() === startOfDay(now).getTime();
  const when = isToday ? "today" : `on ${fmtDate(date)}`;
  const { state, r } = situation(date);
  const pos = Astro.geo("mercury", Astro.jd(date));
  const sign = signName(pos.lon);
  let yes = state === "retro";

  $("question").textContent = `Is Mercury retrograde ${when}?`;
  $("answer").textContent = yes ? "Yes." : "No.";
  $("answer").className = "answer " + (yes ? "yes" : "no");

  let status = "";
  let next = "";
  if (state === "retro") {
    const left = daysBetween(date, r.end);
    status = `Mercury is retrograde in ${sign}, moving backward through the zodiac since ${fmtDate(r.start)}.`;
    next = `It stations direct on <strong>${fmtDate(r.end)}</strong> (${inDays(left)}) at ${fmtLon(r.lonEnd)}, then stays in its shadow until ${fmtDate(r.postShadow)}.`;
  } else if (state === "pre") {
    const n = daysBetween(date, r.start);
    status = `But Mercury is in its <strong>pre-retrograde shadow</strong> in ${sign}: it is slowing down over the stretch of sky it will cross again backward.`;
    next = `It stations retrograde on <strong>${fmtDate(r.start)}</strong> (${inDays(n)}) at ${fmtLon(r.lonStart)}, until ${fmtDate(r.end)}.`;
  } else if (state === "post") {
    status = `But Mercury is in its <strong>post-retrograde shadow</strong> in ${sign}: moving forward again over ground it just crossed backward.`;
    next = `It leaves the shadow on <strong>${fmtDate(r.postShadow)}</strong> (${inDays(daysBetween(date, r.postShadow))}), back at ${fmtLon(r.lonStart)} where the retrograde began.`;
  } else {
    status = `Mercury is moving forward (direct) through ${sign}.`;
    if (r && r.start > date) {
      const n = daysBetween(date, r.start);
      next = `The next Mercury retrograde is <strong>${fmtRange(r.start, r.end)}</strong> in ${signsSpan(r.lonStart, r.lonEnd)}, ${inDays(n)}. Its shadow begins ${fmtDate(r.preShadow)}.`;
    }
  }
  $("status").innerHTML = status;
  $("next").innerHTML = next;
  $("date-input").value = isoDay(date);
  $("today-link").style.visibility = isToday ? "hidden" : "visible";

  focus = r;
  renderLoop();
  setupSlider();
  showYear(date.getFullYear());
}

// ---------------------------------------------------------------- the loop

const chartWidth = (el) => Math.round(Math.max(300, Math.min(720, el.clientWidth || 720)));

function renderLoop() {
  const r = focus;
  const box = $("loop-chart");
  if (!r) {
    box.innerHTML = "";
    return;
  }
  $("loop-title").textContent = `The loop in the sky, ${fmtRange(r.start, r.end)}`;
  $("loop-caption").textContent =
    `Mercury's path against the stars, one dot per day, from before its shadow to after it. ` +
    `It moves left to right, slows down and bunches up, loops back, then goes on. ` +
    `The height is stretched to show the loop.`;

  const j0 = Astro.jd(r.preShadow) - 12;
  const j1 = Astro.jd(r.postShadow) + 12;
  const pts = [];
  let base = Astro.geo("mercury", j0).lon;
  let acc = 0;
  let prevLon = base;
  for (let j = j0; j <= j1 + 0.01; j += 0.25) {
    const g = Astro.geo("mercury", j);
    acc += Astro.angDiff(prevLon, g.lon);
    prevLon = g.lon;
    pts.push({ j, x: acc, lat: g.lat });
  }
  // drawn at the width it is shown at, so the text keeps its size on phones
  const W = chartWidth(box), H = W < 500 ? 220 : 240, padL = 20, padR = 20, padT = 34, padB = 34;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.lat);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  const yPad = Math.max((yMax - yMin) * 0.25, 0.3);
  yMin -= yPad;
  yMax += yPad;
  const X = (x) => padL + ((x - xMin) / (xMax - xMin)) * (W - padL - padR);
  const Y = (lat) => padT + ((yMax - lat) / (yMax - yMin)) * (H - padT - padB);
  const at = (j) => {
    const i = Math.max(0, Math.min(pts.length - 1, Math.round((j - j0) * 4)));
    return pts[i];
  };

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mercury's apparent path around the retrograde of ${fmtRange(r.start, r.end)}">`;
  // sign boundaries
  for (let k = Math.ceil((base + xMin) / 30); k * 30 <= base + xMax; k++) {
    const x = X(k * 30 - base);
    svg += `<line class="sign-line" x1="${x}" y1="${padT - 12}" x2="${x}" y2="${H - padB + 8}" />`;
  }
  // sign names, centered in the visible part of each sign
  for (let k = Math.floor((base + xMin) / 30); k * 30 < base + xMax; k++) {
    const a = Math.max(k * 30 - base, xMin), b = Math.min((k + 1) * 30 - base, xMax);
    if (X(b) - X(a) < 60) continue;
    const s = Astro.SIGNS[((k % 12) + 12) % 12];
    svg += `<text class="sign-label" x="${(X(a) + X(b)) / 2}" y="${padT - 16}" text-anchor="middle">${s.glyph} ${s.name}</text>`;
  }
  // the path, one segment per phase
  const seg = (ja, jb, cls) => {
    const p = pts.filter((q) => q.j >= ja - 0.01 && q.j <= jb + 0.01).map((q) => `${X(q.x).toFixed(1)},${Y(q.lat).toFixed(1)}`);
    return p.length > 1 ? `<polyline class="${cls}" points="${p.join(" ")}" />` : "";
  };
  const jPre = Astro.jd(r.preShadow), jR = Astro.jd(r.start), jD = Astro.jd(r.end), jPost = Astro.jd(r.postShadow);
  svg += seg(j0, jPre, "path-direct");
  svg += seg(jPre, jR, "path-shadow");
  svg += seg(jR, jD, "path-retro");
  svg += seg(jD, jPost, "path-shadow");
  svg += seg(jPost, j1, "path-direct");
  // one dot a day
  for (let j = Math.ceil(j0); j <= j1; j++) {
    const p = at(j);
    svg += `<circle class="day-dot" cx="${X(p.x).toFixed(1)}" cy="${Y(p.lat).toFixed(1)}" r="1.6" />`;
  }
  // stations
  const station = (j, label, below) => {
    const p = at(j);
    const x = X(p.x), y = Y(p.lat);
    const ty = below ? y + 20 : y - 12;
    return `<circle class="station" cx="${x}" cy="${y}" r="4.5" /><text class="station-label" x="${x}" y="${ty}" text-anchor="middle">${label}</text>`;
  };
  // put each label on the side of the loop away from the other
  const upR = at(jR).lat >= at(jD).lat;
  svg += station(jR, `Retrograde ${fmtDate(r.start, false)}`, !upR);
  svg += station(jD, `Direct ${fmtDate(r.end, false)}`, upR);
  // the date asked about, when it is on the chart
  const jc = Astro.jd(current);
  if (jc >= j0 && jc <= j1) {
    const p = at(jc);
    svg += `<circle class="today-dot" cx="${X(p.x)}" cy="${Y(p.lat)}" r="6" /><title>${esc(fmtDate(current))}</title>`;
  }
  // the slider's date
  svg += `<g id="loop-marker"><circle class="marker" r="7" cx="-20" cy="-20" /><text class="marker-glyph" x="-20" y="-20" text-anchor="middle" dominant-baseline="central">☿&#xFE0E;</text></g>`;
  // legend
  const ly = H - 10;
  svg += `<g class="legend"><line class="path-retro" x1="${padL}" y1="${ly - 4}" x2="${padL + 22}" y2="${ly - 4}" /><text x="${padL + 28}" y="${ly}">retrograde</text>`;
  svg += `<line class="path-shadow" x1="${padL + 120}" y1="${ly - 4}" x2="${padL + 142}" y2="${ly - 4}" /><text x="${padL + 148}" y="${ly}">shadow</text>`;
  svg += `<circle class="today-dot" cx="${padL + 225}" cy="${ly - 4}" r="5" /><text x="${padL + 236}" y="${ly}">${esc(fmtDate(current))}</text></g>`;
  svg += "</svg>";
  box.innerHTML = svg;
  box._scale = { X, Y, at, j0, j1 };
}

function moveLoopMarker(j) {
  const s = $("loop-chart")._scale;
  const g = document.getElementById("loop-marker");
  if (!s || !g) return;
  const p = s.at(Math.max(s.j0, Math.min(s.j1, j)));
  const x = s.X(p.x), y = s.Y(p.lat);
  g.children[0].setAttribute("cx", x);
  g.children[0].setAttribute("cy", y);
  g.children[1].setAttribute("x", x);
  g.children[1].setAttribute("y", y);
}

// ---------------------------------------------------------------- orrery

// heliocentric position referred to the equinox of date (as the zodiac ring)
function helioOfDate(id, j) {
  const p = Astro.helio(id, j);
  const T = (j - 2451545) / 36525;
  const a = (1.396971 * T * Math.PI) / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
}

function renderOrrery(j) {
  const S = 360, c = S / 2, R = 150; // zodiac ring radius
  const k = 108; // px per au
  const P = (p) => ({ x: c + p.x * k, y: c - p.y * k });
  const ang = (lon, r) => {
    const a = (lon * Math.PI) / 180;
    return { x: c + r * Math.cos(a), y: c - r * Math.sin(a) };
  };
  const e = helioOfDate("earth", j), m = helioOfDate("mercury", j);
  const E = P(e), M = P(m);
  const geo = Astro.geo("mercury", j);
  const retro = Astro.speed("mercury", j) < 0;

  let svg = `<svg viewBox="0 0 ${S} ${S}" role="img" aria-label="The Sun, Mercury and the Earth seen from above">`;
  // zodiac ring
  svg += `<circle class="zodiac-ring" cx="${c}" cy="${c}" r="${R}" /><circle class="zodiac-ring inner" cx="${c}" cy="${c}" r="${R - 22}" />`;
  for (let i = 0; i < 12; i++) {
    const a = ang(i * 30, R), b = ang(i * 30, R - 22);
    svg += `<line class="zodiac-tick" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
    const t = ang(i * 30 + 15, R - 11);
    svg += `<text class="zodiac-glyph" x="${t.x}" y="${t.y}" text-anchor="middle" dominant-baseline="central"><title>${Astro.SIGNS[i].name}</title>${Astro.SIGNS[i].glyph}</text>`;
  }
  // orbits (drawn as the planets' actual ellipses, sampled over one year / 88 days)
  const orbit = (id, days) => {
    const pts = [];
    for (let t = 0; t <= days; t += days / 120) {
      const q = P(helioOfDate(id, j + t));
      pts.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
    }
    return `<polyline class="orbit" points="${pts.join(" ")}" />`;
  };
  svg += orbit("earth", 365.25) + orbit("mercury", 87.97);
  // line of sight, from the Earth through Mercury to the zodiac ring
  const dx = M.x - E.x, dy = M.y - E.y, L = Math.hypot(dx, dy);
  const ux = dx / L, uy = dy / L;
  // distance along the ray to the ring's inner edge
  const fx = E.x - c, fy = E.y - c, r2 = R - 22;
  const bq = fx * ux + fy * uy, cq = fx * fx + fy * fy - r2 * r2;
  const tRay = -bq + Math.sqrt(bq * bq - cq);
  const H = { x: E.x + ux * tRay, y: E.y + uy * tRay };
  svg += `<line class="sight ${retro ? "retro" : ""}" x1="${E.x}" y1="${E.y}" x2="${H.x}" y2="${H.y}" />`;
  svg += `<circle class="sight-hit ${retro ? "retro" : ""}" cx="${H.x}" cy="${H.y}" r="5" />`;
  // bodies
  svg += `<circle class="sun" cx="${c}" cy="${c}" r="10" />`;
  svg += `<circle class="earth" cx="${E.x}" cy="${E.y}" r="6" />`;
  svg += `<circle class="mercury ${retro ? "retro" : ""}" cx="${M.x}" cy="${M.y}" r="4.5" />`;
  svg += `<text class="body-label" x="${E.x + 9}" y="${E.y + 4}">Earth</text>`;
  svg += `<text class="body-label" x="${M.x + 7}" y="${M.y - 7}">Mercury</text>`;
  svg += "</svg>";
  $("orrery").innerHTML = svg;
  $("slider-date").innerHTML = `${fmtDate(Astro.fromJd(j))} · ${fmtLon(geo.lon)} · <span class="${retro ? "tag-retro" : "tag-direct"}">${retro ? "retrograde" : "direct"}</span>`;
  moveLoopMarker(j);
}

function setupSlider() {
  const r = focus;
  if (!r) return;
  sliderStart = Astro.jd(r.preShadow) - 12;
  sliderEnd = Astro.jd(r.postShadow) + 12;
  const jc = Math.max(sliderStart, Math.min(sliderEnd, Astro.jd(current)));
  const s = $("time-slider");
  s.value = Math.round(((jc - sliderStart) / (sliderEnd - sliderStart)) * 1000);
  stop();
  renderOrrery(jc);
}

const sliderJd = () => sliderStart + ($("time-slider").value / 1000) * (sliderEnd - sliderStart);

function stop() {
  if (playing) cancelAnimationFrame(playing);
  playing = null;
  $("play-btn").textContent = "Play";
}

function play() {
  if (playing) return stop();
  const s = $("time-slider");
  if (+s.value >= 1000) s.value = 0;
  $("play-btn").textContent = "Pause";
  let last = performance.now();
  const step = (t) => {
    // about 12 seconds for the whole range
    const dv = ((t - last) / 12000) * 1000;
    last = t;
    s.value = Math.min(1000, +s.value + dv);
    renderOrrery(sliderJd());
    if (+s.value >= 1000) return stop();
    playing = requestAnimationFrame(step);
  };
  playing = requestAnimationFrame(step);
}

// ---------------------------------------------------------------- the year

function showYear(y) {
  y = Math.max(MIN_YEAR, Math.min(MAX_YEAR, y));
  yearShown = y;
  $("year-title").textContent = `Retrogrades in ${y}`;
  $("year-label").textContent = y;
  $("year-prev").disabled = y <= MIN_YEAR;
  $("year-next").disabled = y >= MAX_YEAR;
  renderStrip(y);
  renderTable(y);
}

function renderStrip(y) {
  const W = chartWidth($("year-strip")), rowH = 22, top = 22;
  const narrow = W < 500;
  const left = narrow ? 26 : 84;
  const s = new Date(y, 0, 1), e = new Date(y + 1, 0, 1);
  const X = (d) => left + ((Math.max(s, Math.min(e, d)) - s) / (e - s)) * (W - left - 6);
  const rows = Astro.PLANETS;
  const H = top + rows.length * rowH + 6;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Retrograde periods of each planet in ${y}">`;
  for (let m = 0; m < 12; m++) {
    const x = X(new Date(y, m, 1)), x2 = X(new Date(y, m + 1, 1));
    svg += `<line class="month-line" x1="${x}" y1="${top - 4}" x2="${x}" y2="${H - 4}" />`;
    svg += `<text class="month-label" x="${(x + x2) / 2}" y="${top - 8}" text-anchor="middle">${new Date(y, m, 15).toLocaleDateString(undefined, { month: "narrow" })}</text>`;
  }
  rows.forEach((p, i) => {
    const cy = top + i * rowH + rowH / 2;
    svg += `<text class="planet-label" x="4" y="${cy + 4}"><title>${p.name}</title>${narrow ? p.glyph : `${p.glyph} ${p.name}`}</text>`;
    svg += `<line class="strip-base" x1="${X(s)}" y1="${cy}" x2="${X(e)}" y2="${cy}" />`;
    for (const r of yearRetros(p.id, y)) {
      svg += `<rect class="strip-shadow" x="${X(r.preShadow)}" y="${cy - 5}" width="${Math.max(0, X(r.postShadow) - X(r.preShadow))}" height="10" rx="3"><title>${p.name} shadow ${esc(fmtRange(r.preShadow, r.postShadow))}</title></rect>`;
      svg += `<rect class="strip-retro" x="${X(r.start)}" y="${cy - 5}" width="${Math.max(1.5, X(r.end) - X(r.start))}" height="10" rx="3"><title>${p.name} retrograde ${esc(fmtRange(r.start, r.end))}</title></rect>`;
    }
  });
  if (current.getFullYear() === y) {
    const x = X(current);
    svg += `<line class="now-line" x1="${x}" y1="${top - 4}" x2="${x}" y2="${H - 2}" />`;
  }
  svg += "</svg>";
  $("year-strip").innerHTML = svg;
}

function renderTable(y) {
  let h = `<table><thead><tr><th>Planet</th><th>Stations retrograde</th><th>Stations direct</th><th class="col-shadow">Shadow</th></tr></thead><tbody>`;
  for (const p of Astro.PLANETS) {
    const list = yearRetros(p.id, y);
    if (!list.length) {
      h += `<tr class="none"><td class="planet">${p.glyph} ${p.name}</td><td colspan="3">No retrograde in ${y}</td></tr>`;
      continue;
    }
    list.forEach((r, i) => {
      const now = current >= r.start && current <= r.end;
      h += `<tr class="${now ? "now" : ""}">`;
      h += i === 0 ? `<td class="planet" rowspan="${list.length}">${p.glyph} ${p.name}</td>` : "";
      h += `<td title="${esc(fmtTime(r.start))}">${fmtDate(r.start)}<div class="deg">${fmtLon(r.lonStart)}</div></td>`;
      h += `<td title="${esc(fmtTime(r.end))}">${fmtDate(r.end)}<div class="deg">${fmtLon(r.lonEnd)}</div></td>`;
      h += `<td class="col-shadow">${fmtRange(r.preShadow, r.postShadow)}</td>`;
      h += "</tr>";
    });
  }
  h += "</tbody></table>";
  h += `<p class="note">Stations are the moments a planet stands still before it turns. Hover a date for its time. Pluto, a dwarf planet since 2006, is kept for astrologers.</p>`;
  $("year-table").innerHTML = h;
}

// ---------------------------------------------------------------- setup

function setDate(d, push) {
  current = d;
  renderAnswer();
  if (push) {
    const url = new URL(location.href);
    if (startOfDay(d).getTime() === startOfDay(new Date()).getTime()) url.searchParams.delete("date");
    else url.searchParams.set("date", isoDay(d));
    history.replaceState(null, "", url);
  }
}

function initMercury() {
  const q = parseIso(new URLSearchParams(location.search).get("date"));
  setDate(q || new Date(), false);
  $("date-input").addEventListener("change", (e) => {
    const d = parseIso(e.target.value);
    if (d) setDate(d, true);
  });
  $("today-link").addEventListener("click", (e) => {
    e.preventDefault();
    setDate(new Date(), true);
  });
  $("time-slider").addEventListener("input", () => {
    stop();
    renderOrrery(sliderJd());
  });
  $("play-btn").addEventListener("click", play);
  $("year-prev").addEventListener("click", () => showYear(yearShown - 1));
  $("year-next").addEventListener("click", () => showYear(yearShown + 1));
  // redraw the charts for the new width (they are drawn at the size shown)
  let lastW = window.innerWidth, t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      renderLoop();
      moveLoopMarker(sliderJd());
      renderStrip(yearShown);
    }, 150);
  });
}
