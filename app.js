// GPS Speedometer — live car speed from the phone's GPS. VW Golf 8 classic dial.
'use strict';

const $ = id => document.getElementById(id);
const KMH = 3.6, MPH = 2.236936, M2KM = 0.001;

const els = {
  speedNum: $('speedNum'), speedUnit: $('speedUnit'),
  gpsDot: $('gpsDot'), gpsText: $('gpsText'), accText: $('accText'), clock: $('clock'),
  distVal: $('distVal'), maxVal: $('maxVal'), avgVal: $('avgVal'), tripTimeVal: $('tripTimeVal'),
  lblDist: $('lblDist'), lblTop: $('lblTop'), lblAvg: $('lblAvg'),
  btnStart: $('btnStart'), btnReset: $('btnReset'), btnUnit: $('btnUnit'), btnWake: $('btnWake'),
  btnDemo: $('btnDemo'), btnTheme: $('btnTheme'), btnMusic: $('btnMusic'),
  demoBadge: $('demoBadge'), banner: $('secureBanner'),
};

const state = {
  unit: localStorage.getItem('speedo_unit') || 'kmh',
  running: false, paused: false, demo: false,
  watchId: null, demoTimer: null, wakeLock: null,
  speedTarget: 0, speedShown: 0,
  last: null, lastTs: 0,
  trip: { dist: 0, top: 0, movingMs: 0, startTs: null },
};

// ── units ──
const vertoon = u => u === 'kmh' ? 'km/h' : 'mph';
const uf = u => u === 'mph' ? 0.621371 : 1;            // km/h -> display unit
function avgKph() {                                    // average in km/h
  const ms = state.trip.movingMs;
  if (!ms) return 0;
  return (state.trip.dist / 1000) / (ms / 3600000);
}

function setUnit(u) {
  state.unit = u; localStorage.setItem('speedo_unit', u);
  els.btnUnit.textContent = vertoon(u);
  els.speedUnit.textContent = vertoon(u);
  els.lblDist.textContent = u === 'mph' ? 'DIST (mi)' : 'DIST (km)';
  els.lblTop.textContent = u === 'mph' ? 'TOP (mph)' : 'TOP (km/h)';
  els.lblAvg.textContent = u === 'mph' ? 'AVG (mph)' : 'AVG (km/h)';
  updateDisplay();
}

// ── distance (Haversine) ──
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

function gpsOk(acc) { return acc != null && acc <= 20; }   // good GPS = <= 20 m

// ── one position ──
function onPos(pos) {
  if (state.demo) return;                                  // demo owns the speed while active
  const c = pos.coords;
  const acc = c.accuracy != null ? c.accuracy : 999;
  const now = Date.now();
  const good = gpsOk(acc);

  setGps(good ? 'on' : 'wait', good ? 'GPS fix' : 'weak signal', '±' + Math.round(acc) + ' m');

  const cur = { lat: c.latitude, lon: c.longitude };
  const dt = state.lastTs ? (now - state.lastTs) / 1000 : 0;

  // speed: GPS's own when available, else computed from distance/time
  let spd = null;
  if (typeof c.speed === 'number' && isFinite(c.speed) && c.speed >= 0 && c.speed < 120 && good) {
    spd = c.speed;
  } else if (state.last && dt > 0.6 && dt < 12 && good) {
    const d = hav(state.last, cur);
    if (d < 200) spd = d / dt;
  }

  if (spd != null) {
    state.speedTarget = state.speedTarget === 0 ? spd : state.speedTarget * 0.6 + spd * 0.4;  // smoothing
    const kmh = state.speedTarget * KMH;
    if (good && kmh > 1.2) state.trip.top = Math.max(state.trip.top, kmh);
  }

  // trip accumulation
  if (state.running && !state.paused && state.last && good) {
    const d = hav(state.last, cur);
    if (d > 1.2) {                                          // GPS noise filter
      state.trip.dist += d;
      const spdKmh = (d / dt) * KMH;
      if (spdKmh >= 1) state.trip.movingMs += dt * 1000;
      renderTrip();
    }
  }

  if (d > 1.2 || !state.last) { state.last = cur; state.lastTs = now; }
  updateDisplay();
}

function setGps(kind, txt, acc) {
  els.gpsDot.className = 'dot ' + kind;
  els.gpsText.textContent = txt;
  if (acc) els.accText.textContent = acc;
}

function onGeoError(err) {
  const msg = err && err.code === 1 ? 'permission denied'
    : err && err.code === 2 ? 'unavailable' : 'timed out';
  setGps('off', 'GPS: ' + msg);
  if (!state.demo) els.accText.textContent = '–';
}

// ── VW Golf 8 classic dial (SVG): 0-240 scale, ticks, numbers, needle ──
function buildDial() {
  const svg = document.getElementById('dialSvg');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const ticksG = document.getElementById('ticks');
  const numsG = document.getElementById('nums');
  const c = 100;
  // ticks every 10 km/h; long (major) every 20. Speed v sits at angle 240+v degrees (clockwise from 12 o'clock).
  for (let v = 0; v <= 240; v += 10) {
    const a = (240 + v) * Math.PI / 180;
    const ux = Math.sin(a), uy = -Math.cos(a);
    const major = v % 20 === 0;
    const r1 = major ? 94.5 : 92.5, r2 = major ? 86.5 : 90;
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('class', 'tick' + (major ? ' major' : ''));
    l.setAttribute('x1', (c + ux * r1).toFixed(2)); l.setAttribute('y1', (c + uy * r1).toFixed(2));
    l.setAttribute('x2', (c + ux * r2).toFixed(2)); l.setAttribute('y2', (c + uy * r2).toFixed(2));
    ticksG.appendChild(l);
  }
  // numbers every 20 km/h, horizontal, inside the ticks
  for (let v = 0; v <= 240; v += 20) {
    const a = (240 + v) * Math.PI / 180;
    const r = 78;
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('class', 'tnum');
    t.setAttribute('x', (c + Math.sin(a) * r).toFixed(2));
    t.setAttribute('y', (c - Math.cos(a) * r + 2.6).toFixed(2));
    t.setAttribute('text-anchor', 'middle');
    t.textContent = v;
    numsG.appendChild(t);
  }
  // slim needle, from hub outward (0 km/h = 240°, 240 km/h = 120° on screen)
  const mount = document.getElementById('needleMount');
  const needle = document.createElementNS(NS, 'g');
  needle.setAttribute('class', 'needle');
  const poly = document.createElementNS(NS, 'polygon');
  poly.setAttribute('points', '-2.4,16 0,-87 2.4,16');
  needle.appendChild(poly);
  mount.appendChild(needle);
  mount.setAttribute('transform', 'translate(100 100) rotate(240)');
}

// display: rotate needle to (240 + km/h) and update the digital readout
function updateDisplay() {
  const kmh = Math.min(240, Math.max(0, state.speedShown * KMH));
  const nm = document.getElementById('needleMount');
  if (nm) nm.setAttribute('transform', 'translate(100 100) rotate(' + (240 + kmh).toFixed(2) + ')');
  els.speedNum.textContent = Math.round(kmh * uf(state.unit));
}
buildDial();

// smooth display loop (speedShown is m/s; eased toward the target each frame)
function loop() {
  state.speedShown += (state.speedTarget - state.speedShown) * 0.22;
  if (Math.abs(state.speedShown - state.speedTarget) < 0.2) state.speedShown = state.speedTarget;
  updateDisplay();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ── clock ──
function tickClock() {
  const d = new Date();
  els.clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
setInterval(tickClock, 5000); tickClock();

// ── GPS start/stop ──
function startGps() {
  if (!('geolocation' in navigator)) {
    setGps('off', 'no GPS on this device');
    return false;
  }
  if (state.watchId != null) return true;
  state.watchId = navigator.geolocation.watchPosition(onPos, onGeoError,
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  setGps('wait', 'Searching GPS…');
  return true;
}
function stopGps() {
  if (state.watchId != null) { navigator.geolocation.clearWatch(state.watchId); state.watchId = null; }
}

// ── demo mode (no GPS needed — test/show) ──
let demoV = 0;
function startDemo() {
  state.demo = true; els.demoBadge.classList.remove('hidden');
  stopGps();
  demoV = 0;
  state.demoTimer = setInterval(() => {
    if (typeof window.__fixSpd === 'number') {
      demoV = window.__fixSpd;                    // dev/test: fixed speed
    } else {
      demoV = Math.max(0, Math.min(128, demoV + (Math.random() - 0.48) * 9));
    }
    state.speedTarget = demoV / KMH;
    if (state.running && !state.paused) {
      state.trip.top = Math.max(state.trip.top, demoV);
      state.trip.dist += demoV / 3.6 * 1.0 * (Math.random() * 0.3 + 0.85);   // ~1 s intervals
      state.trip.movingMs += 1000;
      renderTrip();
    }
  }, 1000);
  setGps('on', 'DEMO running');
  els.accText.textContent = 'simulated';
}
function stopDemo() {
  state.demo = false;
  els.demoBadge.classList.add('hidden');
  if (state.demoTimer) clearInterval(state.demoTimer);
  state.demoTimer = null;
}

// ── trip controls ──
function renderTrip() {
  const km = state.trip.dist * M2KM;
  els.distVal.textContent = (state.unit === 'mph' ? km * 0.621371 : km).toFixed(2);
  els.avgVal.textContent = Math.round(avgKph() * uf(state.unit));
  els.maxVal.textContent = Math.round(state.trip.top * uf(state.unit));
  els.tripTimeVal.textContent = fmtTime(state.trip.movingMs);
}
function resetTrip() {
  state.trip = { dist: 0, top: 0, movingMs: 0, startTs: null };
  state.last = null; state.lastTs = 0;
  state.speedTarget = 0; state.speedShown = 0;
  renderTrip(); updateDisplay();
}
function tripTicker() {
  if (state.running && !state.paused) els.tripTimeVal.textContent = fmtTime(state.trip.movingMs + 500);
}
setInterval(tripTicker, 1000);

els.btnStart.addEventListener('click', () => {
  if (!state.running) {                       // start
    state.running = true; state.paused = false;
    els.btnStart.textContent = '⏸ Pause';
    els.btnStart.classList.add('active');
    if (!state.demo) startGps();
    requestWake();
  } else if (!state.paused) {                 // pause
    state.paused = true;
    els.btnStart.textContent = '▶ Resume';
    els.btnStart.classList.remove('active');
    releaseWake();
  } else {                                    // resume
    state.paused = false;
    els.btnStart.textContent = '⏸ Pause';
    els.btnStart.classList.add('active');
    if (!state.demo) startGps();
    requestWake();
  }
});

els.btnReset.addEventListener('click', () => {
  doStop();
  resetTrip();
  if (state.demo) { stopDemo(); setGps('off', 'GPS idle'); els.accText.textContent = '–'; }
});
function doStop() {
  state.running = false; state.paused = false;
  els.btnStart.textContent = '▶ Start';
  els.btnStart.classList.remove('active');
  releaseWake();
  if (!state.demo) { stopGps(); setGps('wait', 'Searching GPS…'); }
}

els.btnUnit.addEventListener('click', () => setUnit(state.unit === 'kmh' ? 'mph' : 'kmh'));

els.btnDemo.addEventListener('click', () => {
  if (state.demo) {
    stopDemo();
    if (state.running) startGps();
    else setGps('off', 'GPS idle');
  } else {
    stopGps();
    startDemo();
  }
});

// ── day/night theme (auto by time; tap to set) ──
const THEME_KEY = 'speedo_theme';
let themeAuto = !localStorage.getItem(THEME_KEY);
function applyTheme() {
  const h = new Date().getHours();
  const light = themeAuto ? (h >= 6 && h < 19) : localStorage.getItem(THEME_KEY) === 'light';
  document.body.classList.toggle('light', light);
  els.btnTheme.textContent = light ? '🌞' : '🌙';
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.setAttribute('content', light ? '#e9eef5' : '#07090f');
}
els.btnTheme.addEventListener('click', () => {
  themeAuto = false;
  const nowLight = document.body.classList.contains('light');
  localStorage.setItem(THEME_KEY, nowLight ? 'dark' : 'light');
  applyTheme();
});
applyTheme();
setInterval(applyTheme, 60000);

// ── YouTube Music — ONE BIG TAP, straight to the app ──
els.btnMusic.addEventListener('click', () => {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) {
    try {
      window.location.href = 'intent://music.youtube.com/#Intent;scheme=https;' +
        'package=com.google.android.apps.youtube.music;' +
        'S.browser_fallback_url=https%3A%2F%2Fmusic.youtube.com;end';
    } catch (e) {
      window.open('https://music.youtube.com', '_blank');
    }
  } else {
    window.open('https://music.youtube.com', '_blank');
  }
});

// allow free rotation even if a previous lock is still held
try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.running && !state.paused && !state.demo) startGps();
});

if (!('geolocation' in navigator) && !location.protocol.startsWith('https') && location.hostname !== 'localhost') {
  els.banner.classList.remove('hidden');
}

// startup
setUnit(state.unit);
resetTrip();

// ── automated test hook (development: ?autotest=1, optional &spd=120) ──
const qp = new URLSearchParams(location.search);
if (qp.has('autotest')) {
  const fix = parseFloat(qp.get('spd'));
  if (isFinite(fix)) window.__fixSpd = Math.max(0, Math.min(240, fix));
  startDemo();
  setTimeout(() => els.btnStart.click(), 300);
  setTimeout(() => {
    if (typeof window.__fixSpd === 'number') { state.speedShown = state.speedTarget; }
    updateDisplay();
    const nm = document.getElementById('needleMount');
    const res1 = {
      speed: els.speedNum.textContent,
      target_kmh: Math.round(state.speedTarget * KMH),
      needle_rot: nm ? nm.getAttribute('transform') : 'none',
      dist: els.distVal.textContent,
      max: els.maxVal.textContent,
      gem: els.avgVal.textContent,
      tyd: els.tripTimeVal.textContent,
      gps: els.gpsText.textContent,
      demo: !els.demoBadge.classList.contains('hidden'),
      unit: els.speedUnit.textContent,
    };
    els.btnUnit.click();
    const res2 = { speed_mph: els.speedNum.textContent, unit: els.speedUnit.textContent };
    document.body.setAttribute('data-autotest', JSON.stringify({ ...res1, ...res2 }));
  }, 9000);
}
