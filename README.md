# GPS Speedometer

A live car speedometer using the phone's GPS, styled like the VW Golf 8 / Golf R
digital cockpit (classic dial, light & dark themes, R-blue accents). No server —
everything runs on the phone. Optimized for landscape mounting in a car.

## Install on your phone (Android)

1. Open in **Chrome**: https://jpgreyling44.github.io/gps-speedo/
2. ⋮ menu → **"Install app"** → icon on home screen, fullscreen, works offline.

## Driving use

- Rotate the phone freely — the layout adapts automatically (portrait / landscape).
- **▶ Start** — starts the trip (asks GPS permission first time).
- **⏸ Pause / ▶ Resume** — pause without losing the trip. **Reset** — stop & clear.
- **🎵 YouTube Music** — one big tap opens the app (or the website). For music
  next to the speedo: open the app, tap the recent-apps button, tap the Speedo
  card icon → "Open in split screen" → pick YouTube Music.
- **km/h / mph**, **🌞/🌙** day/night (auto by time; tap to lock), **☀** keep
  screen on, **Demo** to test without GPS.

## Accuracy tips

- Allow GPS permission "while using the app"; keep the phone flat with open sky.
- First fix can take 10-30 s; accuracy <= 20 m counts as "GPS fix".
- Speed comes from the GPS chip, with a computed fallback. The dial is 0-240
  km/h (1° = 1 km/h) and clamps at 240 — the needle cannot go past the mark.

## Development

- Static app: `index.html` + `styles.css` + `app.js` (no framework).
- PWA: `manifest.webmanifest` + `sw.js`. Local test: `python3 -m http.server 8751`
- Auto test: `http://localhost:8751/?autotest=1` (+ `&spd=120` for fixed speed);
  results are written to `data-autotest` (includes the needle rotation).
- Icons: `python3 gen_icons.py`.  Files: `D:\jparibix\projects\gps-speedo`
