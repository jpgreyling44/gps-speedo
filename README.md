# GPS Spoedmeter — Golf-uitgawe

Lewendige spoedmeter wat die foon se GPS gebruik. Geoptimaliseer vir
**landskap-montering in 'n ou kar** (VW Golf Mk1: geen infotainment nie —
houer + foon), met dagmodus teen sonlig.

## Installeer op jou foon (S22/Android)

1. Maak oop in **Chrome**: https://jpgreyling44.github.io/gps-speedo/
2. ⋮ → **"Installeer app"** → ikoon op tuisskerm, volskerm, vanlyn.

## Gebruik in die kar (Golf)

- **Draai die foon horisontaal** in die houer — die uitleg wissel outomaties
  na landskap: meter links, statistiek regs, groot syfers.
- **🌞/🌙** — dag- of nag-uitkyk. Outomaties by tyd (06:00-19:00 lig);
  druk die knoppie om dit vas te stel.
- **☀** — hou die skerm aan (wakelock) terwyl jy ry.
- **km/h / mph** — eenhede.
- **Demo** — toets sonder GPS.

## YouTube Music

'n Regte YouTube Music-speler KAN NIE binne die spoedmeter ingebed word nie —
Google blokkeer dit (YouTube Music is 'n aparte app/diens, geen iframe/API vir
die volle diens nie). Wat wel werk:

- **🎵-knoppie** in die app maak YouTube Music dadelik oop (die app as dit
  geïnstalleer is, anders die webwerf).
- **Android-split-skerm**: druk die onlangse-apps-knoppie → tik die
  Spoedmeter-ikoon → "Oop in gesplete skerm" → kies YouTube Music.
  Nou sien jy spoed bo en musiek onder — perfek in landskap op die S22.

## Akkuraatheid

- GPS-toestemming "terwyl die app gebruik word"; lê die foon plat met oop hemel.
- Eerste vasvat 10-30 s; akkuraatheid <= 20 m = "GPS vas".
- Spoed kom van die GPS-chip, met 'n berekende rugsteun.

## Ontwikkeling

- Staties: `index.html` + `styles.css` + `app.js` (geen raamwerk nie).
- PWA: `manifest.webmanifest` + `sw.js`. Toets: `python3 -m http.server 8751`
- Outo-toets: `http://localhost:8751/?autotest=1` → lees `data-autotest`.
- Ikone: `python3 gen_icons.py`.  Lêers: `D:\jparibix\projects\gps-speedo`
