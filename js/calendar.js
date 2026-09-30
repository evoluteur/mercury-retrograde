// Mercury retrograde calendar -- one month, a cell per day with Mercury's
// state (retrograde, station, shadow), its sign, and the other planets that
// are retrograde. Positions come from astro.js.

/* global Astro */

const CAL_MIN = new Date(1800, 0, 1);
const CAL_MAX = new Date(2050, 11, 1);
let month = null; // first day of the month shown

const $c = (id) => document.getElementById(id);

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const shortDate = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

// first day of the week for the visitor's locale (0 = Sunday), Sunday if unknown
function firstWeekday() {
  try {
    const loc = new Intl.Locale(navigator.language);
    const info = loc.getWeekInfo ? loc.getWeekInfo() : loc.weekInfo;
    if (info && info.firstDay) return info.firstDay % 7;
  } catch (e) {}
  return 0;
}

const retroCache = {};
function retrosOf(id, year) {
  const k = id + year;
  if (!retroCache[k]) {
    retroCache[k] = Astro.retrogrades(id, Astro.jd(new Date(year, 0, 1)), Astro.jd(new Date(year + 1, 0, 1)));
  }
  return retroCache[k];
}
// retrogrades touching a month (the shadows can start the year before)
function retrosNear(id, d) {
  const y = d.getFullYear();
  const seen = new Set();
  return [y - 1, y, y + 1]
    .flatMap((yy) => retrosOf(id, yy))
    .filter((r) => (seen.has(+r.start) ? false : seen.add(+r.start)));
}

// Mercury's state for the day [d0, d1)
function dayState(retros, d0, d1) {
  for (const r of retros) {
    if (r.start >= d0 && r.start < d1) return { kind: "sr", r };
    if (r.end >= d0 && r.end < d1) return { kind: "sd", r };
    if (d0 >= r.start && d1 <= r.end) return { kind: "retro", r };
    if (d1 > r.preShadow && d0 < r.start) return { kind: "pre", r };
    if (d0 < r.postShadow && d1 > r.end) return { kind: "post", r };
  }
  return { kind: "direct" };
}

const KIND_TEXT = {
  sr: "Mercury stations retrograde",
  sd: "Mercury stations direct",
  retro: "Mercury retrograde",
  pre: "Mercury in its pre-retrograde shadow",
  post: "Mercury in its post-retrograde shadow",
  direct: "Mercury direct",
};

function renderMonth() {
  const y = month.getFullYear(), m = month.getMonth();
  const monthName = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  $c("month-label").textContent = monthName;
  $c("cal-title").textContent = `Mercury retrograde calendar, ${monthName}`;
  document.title = `Mercury Retrograde Calendar, ${monthName}`;
  $c("month-prev").disabled = month <= CAL_MIN;
  $c("month-next").disabled = month >= CAL_MAX;
  const thisMonth = new Date();
  $c("this-month").style.visibility = y === thisMonth.getFullYear() && m === thisMonth.getMonth() ? "hidden" : "visible";

  const showOthers = $c("show-planets").checked;
  const merc = retrosNear("mercury", month);
  const others = Astro.PLANETS.filter((p) => p.id !== "mercury").map((p) => ({ p, list: retrosNear(p.id, month) }));
  const first = firstWeekday();
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() - first + 7) % 7;
  const todayKey = ymd(new Date());

  let h = '<div class="cal-row cal-head" role="row">';
  for (let i = 0; i < 7; i++) {
    // Jan 7, 2024 was a Sunday
    const wd = new Date(2024, 0, 7 + ((first + i) % 7));
    h += `<div class="cal-wd" role="columnheader"><span class="wd-long">${wd.toLocaleDateString(undefined, { weekday: "short" })}</span><span class="wd-short">${wd.toLocaleDateString(undefined, { weekday: "narrow" })}</span></div>`;
  }
  h += '</div><div class="cal-grid">';
  for (let i = 0; i < lead; i++) h += '<div class="cal-day empty"></div>';

  let prevSign = Astro.signOf(Astro.geo("mercury", Astro.jd(new Date(y, m, 0, 12))).lon).name;
  const retroDays = [];
  for (let d = 1; d <= days; d++) {
    const d0 = new Date(y, m, d), d1 = new Date(y, m, d + 1);
    const st = dayState(merc, d0, d1);
    const sign = Astro.signOf(Astro.geo("mercury", Astro.jd(new Date(y, m, d, 12))).lon);
    const ingress = sign.name !== prevSign;
    prevSign = sign.name;
    if (st.kind === "sr" || st.kind === "sd" || st.kind === "retro") retroDays.push(d);

    let icon = "";
    if (st.kind === "retro") icon = '<span class="cal-icon retro">℞</span>';
    else if (st.kind === "sr") icon = '<span class="cal-icon station">SR</span>';
    else if (st.kind === "sd") icon = '<span class="cal-icon station">SD</span>';

    let tip = `${shortDate(d0)}: ${KIND_TEXT[st.kind]} in ${sign.name}`;
    if (st.kind === "sr") tip += ` at ${st.r.start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    if (st.kind === "sd") tip += ` at ${st.r.end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    if (ingress) tip += ` (enters ${sign.name})`;

    let oth = "";
    if (showOthers) {
      const on = others.filter(({ list }) => list.some((r) => d1 > r.start && d0 < r.end));
      if (on.length) {
        oth = `<span class="cal-others">${on.map(({ p }) => `<span title="${p.name} retrograde">${p.glyph}</span>`).join("")}</span>`;
        tip += `. Also retrograde: ${on.map(({ p }) => p.name).join(", ")}`;
      }
    }
    const cls = ["cal-day", st.kind, ymd(d0) === todayKey ? "today" : ""].join(" ");
    h +=
      `<a class="${cls}" href="index.html?date=${ymd(d0)}" title="${tip}" role="gridcell">` +
      `<span class="cal-num">${d}</span>${icon}` +
      `<span class="cal-sign${ingress ? " ingress" : ""}">${sign.glyph}</span>${oth}</a>`;
  }
  const trail = (7 - ((lead + days) % 7)) % 7;
  for (let i = 0; i < trail; i++) h += '<div class="cal-day empty"></div>';
  h += "</div>";
  $c("calendar").innerHTML = h;
  document.querySelector(".legend-planets").style.display = showOthers ? "" : "none";
  renderSummary(merc, y, m, retroDays.length);
}

// one line above the grid: the retrograde in (or nearest to) this month
function renderSummary(merc, y, m, nRetroDays) {
  const s = new Date(y, m, 1), e = new Date(y, m + 1, 1);
  const r = merc.find((q) => q.postShadow > s && q.preShadow < e);
  const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const sign = (lon) => Astro.signOf(lon).name;
  let t;
  if (r && nRetroDays) {
    t = `Mercury is retrograde from <strong>${fmt(r.start)}</strong> to <strong>${fmt(r.end)}</strong>, ${sign(r.lonStart) === sign(r.lonEnd) ? `in ${sign(r.lonStart)}` : `from ${sign(r.lonStart)} back into ${sign(r.lonEnd)}`}; its shadow runs ${fmt(r.preShadow)} – ${fmt(r.postShadow)}.`;
  } else if (r) {
    t = `No retrograde this month, but Mercury is in the shadow of the retrograde of ${fmt(r.start)} – ${fmt(r.end)}.`;
  } else {
    const next = merc.find((q) => q.start >= e);
    t = `Mercury is direct all month.` + (next ? ` The next retrograde is ${fmt(next.start)} – ${fmt(next.end)}.` : "");
  }
  $c("cal-summary").innerHTML = t;
}

function goMonth(d, push = true) {
  const t = new Date(d.getFullYear(), d.getMonth(), 1);
  month = t < CAL_MIN ? CAL_MIN : t > CAL_MAX ? CAL_MAX : t;
  renderMonth();
  if (push) {
    const url = new URL(location.href);
    const now = new Date();
    if (month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth()) url.searchParams.delete("month");
    else url.searchParams.set("month", ym(month));
    history.replaceState(null, "", url);
  }
}

function initCalendar() {
  const q = /^(\d{4})-(\d{2})$/.exec(new URLSearchParams(location.search).get("month") || "");
  goMonth(q ? new Date(+q[1], +q[2] - 1, 1) : new Date(), false);
  $c("month-prev").addEventListener("click", () => goMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)));
  $c("month-next").addEventListener("click", () => goMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)));
  $c("this-month").addEventListener("click", (e) => {
    e.preventDefault();
    goMonth(new Date());
  });
  $c("show-planets").addEventListener("change", renderMonth);
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select")) return;
    if (e.key === "ArrowLeft") $c("month-prev").click();
    if (e.key === "ArrowRight") $c("month-next").click();
  });
}
