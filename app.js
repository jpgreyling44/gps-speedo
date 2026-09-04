// GPS Spoedmeter — lees foon se GPS en wys lewendige spoed.
'use strict';

const $ = id => document.getElementById(id);
const KMH = 3.6, MPH = 2.236936, M2KM = 0.001;

const els = {
  speedNum: $('speedNum'), speedUnit: $('speedUnit'),
  gpsDot: $('gpsDot'), gpsText: $('gpsText'), accText: $('accText'), clock: $('clock'),
  distVal: $('distVal'), maxVal: $('maxVal'), avgVal: $('avgVal'), tripTimeVal: $('tripTimeVal'),
  btnStart: $('btnStart'), btnUnit: $('btnUnit'), btnWake: $('btnWake'), btnDemo: $('btnDemo'),
  btnTheme: $('btnTheme'), btnMusic: $('btnMusic'),
  demoBadge: $('demoBadge'), needle: $('needle'), banner: $('secureBanner'),
};

const state = {
  unit: localStorage.getItem('speedo_unit') || 'kmh',
  running: false, paused: false, demo: false,
  watchId: null, demoTimer: null, wakeLock: null,
  speedTarget: 0, speedShown: 0,
  last: null, lastTs: 0,
  trip: { dist: 0, top: 0, movingMs: 0, startTs: null, movingStart: null },
  gpsOk: false,
};

// ── eenhede ──
const MPS = u => u === 'kmh' ? KMH : MPH;              // m/s -> vertoon-eenheid
const vertoon = u => u === 'kmh' ? 'km/h' : 'mph';
const uf = u => u === 'mph' ? 0.621371 : 1;            // km/h -> vertoon-eenheid
function avgKph() {                                    // gemiddelde in km/h
  const ms = state.trip.movingMs;
  if (!ms) return 0;
  return (state.trip.dist / 1000) / (ms / 3600000);
}

function setUnit(u) {
  state.unit = u; localStorage.setItem('speedo_unit', u);
  els.btnUnit.textContent = vertoon(u);
  els.speedUnit.textContent = vertoon(u);
  els.maxVal.textContent = Math.round(state.trip.top * uf(u));
  els.avgVal.textContent = Math.round(avgKph() * uf(u));
  updateDisplay();
}

// ── afstand (Haversine) ──
function hav(a, b) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? String(h).padStart(2, '0') + ':' : '') + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

function gpsOk(acc) { return acc != null && acc <= 20; }   // goeie GPS = <= 20 m

// ── hoof-verwerking van een posisie ──
function onPos(pos) {
  const c = pos.coords;
  const acc = c.accuracy != null ? c.accuracy : 999;
  const now = Date.now();

  setGps(acc <= 20 ? (c.speed != null ? 'on' : 'wait') : 'wait',
    acc <= 20 ? 'GPS vas' : 'swak sein',
    acc <= 20 ? '±' + Math.round(acc) + ' m' : '±' + Math.round(acc) + ' m');

  const cur = { lat: c.latitude, lon: c.longitude };
  const dt = state.lastTs ? (now - state.lastTs) / 1000 : 0;

  // spoed: GPS s'n as beskikbaar, anders bereken uit afstand/tyd
  let spd = null;
  if (typeof c.speed === 'number' && isFinite(c.speed) && c.speed >= 0 && c.speed < 120 && gpsOk(acc)) {
    spd = c.speed;
  } else if (state.last && dt > 0.6 && dt < 12 && gpsOk(acc)) {
    const d = hav(state.last, cur);
    if (d < 200) spd = d / dt;               // teen 200 m/s limiet teen GPS-uitskieters
  }

  if (spd != null) {
    state.speedTarget = state.speedTarget === 0 ? spd : state.speedTarget * 0.65 + spd * 0.35;  // gladmaak
    const kmh = state.speedTarget * KMH;
    if (gpsOk(acc)) {
      if (kmh > 1.2) state.trip.top = Math.max(state.trip.top, kmh);
      els.maxVal.textContent = Math.round(state.trip.top * uf(state.unit));
    }
  }

  // rit-ophoping
  if (state.running && !state.paused && state.last && gpsOk(acc)) {
    const d = hav(state.last, cur);
    if (d > 1.2) {                          // filter GPS-geraas
      state.trip.dist += d;
      const spdKmh = (d / dt) * KMH;
      if (spdKmh >= 1) state.trip.movingMs += dt * 1000;
      els.distVal.textContent = (state.trip.dist * M2KM).toFixed(2);
      els.avgVal.textContent = Math.round(avgKph() * uf(state.unit));
    }
  }

  if (d > 1.2 || !state.last) { state.last = cur; state.lastTs = now; }
  updateDisplay();
}

function setGps(kind, txt, acc) {
  els.gpsDot.className = 'dot ' + kind;
  els.gpsText.textContent = txt;
  if (acc) els.accText.textContent = acc;
  state.gpsOk = kind === 'on';
}

function onGeoError(err) {
  const msg = err && err.code === 1 ? 'toestemming geweier' : err && err.code === 2 ? 'posisie onbeskikbaar' : 'tyd verstreke';
  setGps('off', 'GPS: ' + msg);
  if (!state.demo) els.accText.textContent = '–';
}

// ── naald & syfers (240°-meter, volskaal 240 km/h) ──
function updateDisplay() {
  const kmh = state.speedShown * KMH;                    // vertoon altyd vanaf km/h
  const frac = Math.min(1, Math.max(0, kmh / 240));
  const g = $('gauge');
  if (g) g.style.setProperty('--frac', frac.toFixed(4));
  els.speedNum.textContent = Math.round(kmh * uf(state.unit));
}

// ── VW-tipe skaal-etikette (0..240) langs die boog ──
function buildScale() {
  const host = document.getElementById('gscale');
  if (!host) return;
  const vals = [0, 40, 80, 120, 160, 200, 240];
  vals.forEach(v => {
    const a = (-120 + (v / 240) * 240) * Math.PI / 180;  // 0° = bo
    const r = 37;
    const s = document.createElement('span');
    s.className = 'glabel';
    s.textContent = v;
    s.style.left = (50 + r * Math.sin(a)).toFixed(2) + '%';
    s.style.top = (50 - r * Math.cos(a)).toFixed(2) + '%';
    host.appendChild(s);
  });
}
buildScale();

// gladde vertoon-lus (speedShown is in m/s; elke raam na die teiken toe)
function loop() {
  state.speedShown += (state.speedTarget - state.speedShown) * 0.18;
  if (Math.abs(state.speedShown - state.speedTarget) < 0.3) state.speedShown = state.speedTarget;
  updateDisplay();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ── horlosie ──
function tickClock() {
  const d = new Date();
  els.clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
setInterval(tickClock, 5000); tickClock();

// ── GPS begin/stop ──
function startGps() {
  if (!('geolocation' in navigator)) {
    setGps('off', 'geen GPS op dié toestel');
    return false;
  }
  if (state.watchId != null) return true;
  state.watchId = navigator.geolocation.watchPosition(onPos, onGeoError,
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  setGps('wait', 'GPS soek…');
  return true;
}
function stopGps() {
  if (state.watchId != null) { navigator.geolocation.clearWatch(state.watchId); state.watchId = null; }
}

// ── demo-modus (geen GPS nodig nie — toets/vertoon) ──
let demoV = 0;
function startDemo() {
  state.demo = true; els.demoBadge.classList.remove('hidden');
  demoV = 0;
  state.demoTimer = setInterval(() => {
    demoV = Math.max(0, Math.min(128, demoV + (Math.random() - 0.48) * 9));
    const kmh = demoV;
    state.speedTarget = kmh / KMH;
    if (state.running && !state.paused) {
      state.trip.top = Math.max(state.trip.top, kmh);
      state.trip.dist += kmh / 3600 * 1.0 * 1000 * (Math.random() * 0.3 + 0.85); // ~1s interval
      state.trip.movingMs += 1000;
      renderTrip();
    }
    els.tripTimeVal.textContent = fmtTime(state.trip.movingMs);
    updateDisplay();
  }, 1000);
  setGps('on', 'DEMO loop');
  els.accText.textContent = 'gesimuleer';
}
function stopDemo() {
  state.demo = false;
  els.demoBadge.classList.add('hidden');
  if (state.demoTimer) clearInterval(state.demoTimer);
  state.demoTimer = null;
}

// ── rit-kontroles ──
function renderTrip() {
  els.distVal.textContent = (state.trip.dist * M2KM).toFixed(2);
  els.avgVal.textContent = Math.round(avgKph() * uf(state.unit));
  els.maxVal.textContent = Math.round(state.trip.top * uf(state.unit));
  els.tripTimeVal.textContent = fmtTime(state.trip.movingMs);
}
function resetTrip() {
  state.trip = { dist: 0, top: 0, movingMs: 0, startTs: null, movingStart: null };
  state.last = null; state.lastTs = 0;
  state.speedTarget = state.speedShown = 0;
  renderTrip(); updateDisplay();
}
function tripTicker() {   // werk tyd by terwyl daar beweeg word
  if (state.running && !state.paused) els.tripTimeVal.textContent = fmtTime(state.trip.movingMs + 500);
}
setInterval(tripTicker, 1000);

els.btnStart.addEventListener('click', () => {
  if (!state.running) {                       // begin
    state.running = true; state.paused = false;
    els.btnStart.textContent = '⏸ Pouse';
    els.btnStart.classList.add('active');
    if (!state.demo) startGps();
    requestWake();
  } else if (!state.paused) {                 // pouse
    state.paused = true;
    els.btnStart.textContent = '▶ Gaan voort';
    els.btnStart.classList.remove('active');
    releaseWake();
  } else {                                    // voort
    state.paused = false;
    els.btnStart.textContent = '⏸ Pouse';
    els.btnStart.classList.add('active');
    if (!state.demo) startGps();
    requestWake();
  }
});

// langdruk Stop: hou "Stop" (reset) apart — tweede knoppie-ry is eenvoudiger:
els.btnStart.addEventListener('contextmenu', e => { e.preventDefault(); doStop(); });
function doStop() {
  state.running = false; state.paused = false;
  els.btnStart.textContent = '▶ Begin';
  els.btnStart.classList.remove('active');
  releaseWake();
  if (!state.demo) { stopGps(); setGps('wait', 'GPS soek…'); }
}

els.btnUnit.addEventListener('click', () => {
  setUnit(state.unit === 'kmh' ? 'mph' : 'kmh');
});

els.btnDemo.addEventListener('click', () => {
  if (state.demo) { stopDemo(); if (state.running) startGps(); }
  else { stopGps(); startDemo(); }
});

// ── Dag/Nag-uitkyk (outo by tyd; druk vir handmatig) ──
const THEME_KEY = 'speedo_theme';
let themeAuto = !localStorage.getItem(THEME_KEY);
function applyTheme() {
  const h = new Date().getHours();
  const light = themeAuto ? (h >= 6 && h < 19) : localStorage.getItem(THEME_KEY) === 'light';
  document.body.classList.toggle('light', light);
  els.btnTheme.textContent = light ? '🌞' : '🌙';
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.setAttribute('content', light ? '#e7edf4' : '#0b0e14');
}
els.btnTheme.addEventListener('click', () => {
  themeAuto = false;
  const nowLight = document.body.classList.contains('light');
  localStorage.setItem(THEME_KEY, nowLight ? 'dark' : 'light');
  applyTheme();
});
applyTheme();
setInterval(applyTheme, 60000);   // outo-dag/nag elke minuut solank nie handmatig gekies nie

// ── YouTube Music-kortpad ──
els.btnMusic.addEventListener('click', () => {
  const ua = navigator.userAgent;
  const androidChrome = /Android/i.test(ua) && /Chrome/i.test(ua) && !/Edg/i.test(ua);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (androidChrome && !standalone) {
    // Probeer die YouTube Music-app oopmaak; val terug na die webwerf
    window.location.href = 'intent://music.youtube.com/#Intent;scheme=https;' +
      'package=com.google.android.apps.youtube.music;' +
      'S.browser_fallback_url=https%3A%2F%2Fmusic.youtube.com;end';
  } else {
    window.open('https://music.youtube.com', '_blank');
  }
});

// skerm-aan hou (wakelock)
async function requestWake() {
  try {
    if ('wakeLock' in navigator && !state.wakeLock) {
      state.wakeLock = await navigator.wakeLock.request('screen');
      state.wakeLock.addEventListener('release', () => { state.wakeLock = null; els.btnWake.classList.remove('on'); });
      els.btnWake.classList.add('on');
    }
  } catch (e) { /* nie krities nie */ }
}
function releaseWake() {
  if (state.wakeLock) { try { state.wakeLock.release(); } catch (e) {} state.wakeLock = null; }
  els.btnWake.classList.remove('on');
}
els.btnWake.addEventListener('click', () => {
  if (state.wakeLock) releaseWake();
  else requestWake();
});

// dokument sigbaarheid: laat GPS aanhou in agtergrond is nie nodig nie; by terugkeer herstel
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.running && !state.paused && !state.demo) startGps();
});

// sekuriteit: geolocation vereis sekure konteks
if (!('geolocation' in navigator) && !location.protocol.startsWith('https') && location.hostname !== 'localhost') {
  els.banner.classList.remove('hidden');
}

// opstart
setUnit(state.unit);
resetTrip();

// ── outomatiese toets-haak (ontwikkeling: ?autotest=1) ──
if (new URLSearchParams(location.search).has('autotest')) {
  startDemo();
  setTimeout(() => els.btnStart.click(), 300);
  setTimeout(() => {
    state.speedShown = state.speedTarget;  // een "ingehaal" raam (headless stuur nie rAF nie)
    updateDisplay();
    const res1 = {
      speed: els.speedNum.textContent,
      target_kmh: Math.round(state.speedTarget * KMH),
      dist: els.distVal.textContent,
      max: els.maxVal.textContent,
      gem: els.avgVal.textContent,
      tyd: els.tripTimeVal.textContent,
      gps: els.gpsText.textContent,
      demo: !els.demoBadge.classList.contains('hidden'),
      unit: els.speedUnit.textContent,
    };
    els.btnUnit.click();   // wissel na mph
    const res2 = { speed_mph: els.speedNum.textContent, unit: els.speedUnit.textContent };
    document.body.setAttribute('data-autotest', JSON.stringify({ ...res1, ...res2 }));
  }, 9000);
}
