// Planet positions and retrograde periods, computed in the browser.
//
// Orbits use the Keplerian elements of JPL's "Approximate Positions of the
// Planets" (E. M. Standish, table 1, valid 1800-2050). That is accurate to
// well under a degree, and the retrograde stations it gives land within a
// few hours of the published ephemerides, plenty for dates shown by the day.
//
// Longitudes are geocentric and ecliptic, referred to the equinox of date
// (the tropical zodiac astrologers use). Light time and the Moon's pull on
// the Earth are ignored: both move the stations by minutes, not days.

/* global module */
(function (root) {
  const D2R = Math.PI / 180;
  const J2000 = 2451545.0;
  const DAY_MS = 86400000;

  // a (au), e, I (deg), L (deg), long. perihelion (deg), long. node (deg),
  // each with its rate per Julian century
  const ELEMENTS = {
    mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.2503235, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
    venus: [0.72333566, 0.0000039, 0.00677672, -0.00004107, 3.39467605, -0.0007889, 181.9790995, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
    earth: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
    mars: [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
    jupiter: [5.202887, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
    saturn: [9.53667594, -0.0012506, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
    uranus: [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939, 313.23810451, 428.48202785, 170.9542763, 0.40805281, 74.01692503, 0.04240589],
    neptune: [30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372, -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664],
    pluto: [39.48211675, -0.00031596, 0.2488273, 0.0000517, 17.14001206, 0.00004818, 238.92903833, 145.20780515, 224.06891629, -0.04062942, 110.30393684, -0.01183482],
  };

  // "\uFE0E" asks for the text glyph, so browsers don't swap in color emoji
  const PLANETS = [
    { id: "mercury", name: "Mercury", glyph: "☿\uFE0E" },
    { id: "venus", name: "Venus", glyph: "♀\uFE0E" },
    { id: "mars", name: "Mars", glyph: "♂\uFE0E" },
    { id: "jupiter", name: "Jupiter", glyph: "♃\uFE0E" },
    { id: "saturn", name: "Saturn", glyph: "♄\uFE0E" },
    { id: "uranus", name: "Uranus", glyph: "♅\uFE0E" },
    { id: "neptune", name: "Neptune", glyph: "♆\uFE0E" },
    { id: "pluto", name: "Pluto", glyph: "♇\uFE0E" },
  ];

  const SIGNS = [
    { name: "Aries", glyph: "♈\uFE0E" },
    { name: "Taurus", glyph: "♉\uFE0E" },
    { name: "Gemini", glyph: "♊\uFE0E" },
    { name: "Cancer", glyph: "♋\uFE0E" },
    { name: "Leo", glyph: "♌\uFE0E" },
    { name: "Virgo", glyph: "♍\uFE0E" },
    { name: "Libra", glyph: "♎\uFE0E" },
    { name: "Scorpio", glyph: "♏\uFE0E" },
    { name: "Sagittarius", glyph: "♐\uFE0E" },
    { name: "Capricorn", glyph: "♑\uFE0E" },
    { name: "Aquarius", glyph: "♒\uFE0E" },
    { name: "Pisces", glyph: "♓\uFE0E" },
  ];

  const norm360 = (x) => ((x % 360) + 360) % 360;
  // signed difference b - a, in (-180, 180]
  const angDiff = (a, b) => {
    const d = norm360(b - a);
    return d > 180 ? d - 360 : d;
  };

  const jd = (date) => date.getTime() / DAY_MS + 2440587.5;
  const fromJd = (j) => new Date((j - 2440587.5) * DAY_MS);

  // heliocentric ecliptic coordinates (J2000 frame), in au
  function helio(id, j) {
    const el = ELEMENTS[id];
    const T = (j - J2000) / 36525;
    const a = el[0] + el[1] * T;
    const e = el[2] + el[3] * T;
    const I = (el[4] + el[5] * T) * D2R;
    const L = el[6] + el[7] * T;
    const peri = el[8] + el[9] * T;
    const node = (el[10] + el[11] * T) * D2R;
    const w = peri * D2R - node;
    const M = norm360(L - peri) * D2R;
    let E = M + e * Math.sin(M);
    for (let k = 0; k < 8; k++) {
      const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-12) break;
    }
    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w);
    const cO = Math.cos(node), sO = Math.sin(node);
    const cI = Math.cos(I), sI = Math.sin(I);
    return {
      x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
      y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
      z: sw * sI * xp + cw * sI * yp,
    };
  }

  // geocentric ecliptic longitude and latitude (degrees), equinox of date
  function geo(id, j) {
    const p = helio(id, j);
    const E = helio("earth", j);
    const x = p.x - E.x, y = p.y - E.y, z = p.z - E.z;
    const T = (j - J2000) / 36525;
    const lon = norm360(Math.atan2(y, x) / D2R + 1.396971 * T); // + precession
    const lat = Math.atan2(z, Math.hypot(x, y)) / D2R;
    return { lon, lat, dist: Math.hypot(x, y, z) };
  }

  // apparent motion in degrees per day (negative = retrograde)
  const speed = (id, j) => angDiff(geo(id, j - 0.5).lon, geo(id, j + 0.5).lon);

  const signOf = (lon) => SIGNS[Math.floor(norm360(lon) / 30)];

  // time when f changes sign between j1 and j2, by bisection (to ~1 minute)
  function bisect(f, j1, j2) {
    let f1 = f(j1);
    for (let k = 0; k < 40 && j2 - j1 > 0.0005; k++) {
      const m = (j1 + j2) / 2;
      const fm = f(m);
      if (fm * f1 > 0) {
        j1 = m;
        f1 = fm;
      } else j2 = m;
    }
    return (j1 + j2) / 2;
  }

  // retrograde periods of a planet overlapping [start, end] (JDs), each with
  // its stations, the longitudes they happen at and the shadow periods
  function retrogrades(id, start, end) {
    const out = [];
    const step = id === "mercury" || id === "venus" ? 1 : 2;
    let j = start - 200, prev = speed(id, j), rStart = null;
    for (j += step; j <= end + 200; j += step) {
      const s = speed(id, j);
      if (prev > 0 && s <= 0) rStart = bisect((t) => speed(id, t), j - step, j);
      if (prev < 0 && s >= 0 && rStart !== null) {
        const rEnd = bisect((t) => speed(id, t), j - step, j);
        if (rEnd >= start && rStart <= end) out.push(period(id, rStart, rEnd));
        rStart = null;
      }
      prev = s;
    }
    return out;
  }

  function period(id, jR, jD) {
    const lonR = geo(id, jR).lon, lonD = geo(id, jD).lon;
    // pre-shadow: when the planet first reached the longitude where it will
    // station direct; post-shadow: when it gets back to where it went retrograde
    const reach = (target, from, dir) => {
      const f = (t) => angDiff(target, geo(id, t).lon);
      let t = from;
      const step = id === "mercury" || id === "venus" ? 1 : 3;
      for (let k = 0; k < 400; k++) {
        const t2 = t + dir * step;
        if (f(t) * f(t2) <= 0) return bisect(f, Math.min(t, t2), Math.max(t, t2));
        t = t2;
      }
      return null;
    };
    return {
      planet: id,
      start: fromJd(jR),
      end: fromJd(jD),
      lonStart: lonR,
      lonEnd: lonD,
      preShadow: fromJd(reach(lonD, jR - 1, -1)),
      postShadow: fromJd(reach(lonR, jD + 1, 1)),
    };
  }

  const Astro = { PLANETS, SIGNS, jd, fromJd, helio, geo, speed, signOf, retrogrades, norm360, angDiff };
  if (typeof module !== "undefined" && module.exports) module.exports = Astro;
  else root.Astro = Astro;
})(this);
