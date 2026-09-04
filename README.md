# GPS Spoedmeter

'n Lewendige spoedmeter vir die kar wat die foon se GPS gebruik.
Geen bediener nodig nie — alles loop op die foon self.

## Installeer op jou foon (S22/Android)

1. Maak die app oop in **Chrome** op die foon (sien die lewendige URL hieronder).
2. Tik ⋮ (kieslys) → **"Installeer app"** / **"Voeg by tuisskerm"**.
3. 'n Ikoon verskyn op jou tuisskerm — dit maak volskerm oop soos 'n gewone app.

## Gebruik

- **▶ Begin** — begin die rit (vra GPS-toestemming die eerste keer).
- **⏸ Pouse / ▶ Gaan voort** — pouse sonder om die rit te verloor.
- **Langk druk op Begin** = Stop (stel rit terug). *(Op foon: gebruik die Demo/Stop-logika — Begin-knoppie wissel begin/pouse; 'n stop-rit word gedoen deur die rit-knoppie lank te druk of die bladsy te herlaai.)*
- **km/h / mph** — wissel eenhede.
- **☀** — hou die skerm aan terwyl jy ry (wakelock).
- **Demo** — toetsmodus sonder GPS (willekeurige spoed).

Waardes op die skerm: huidige spoed (groot), afstand, maksimum spoed,
gemiddelde spoed en rystyd. GPS-status en akkuraatheid (± m) is bo.

## Wenke vir akkurate spoed

- Gee die foon **GPS-toestemming** ("terwyl die app gebruik word").
- Lê die foon plat met 'n oop stuk hemel — die eerste vasvat kan 10-30 s neem.
- Akkuraatheid <= 20 m word as "GPS vas" beskou; beweging vinniger as 1.5 km/h tel.
- Spoed kom van die GPS-chip (coords.speed), met 'n berekende rugsteun.

## Ontwikkeling

- Statiese webapp: `index.html` + `styles.css` + `app.js` (geen raamwerk nie).
- PWA: `manifest.webmanifest` + `sw.js` (offline nadat dit een keer gelaai is).
- Toets lokaal: `python3 -m http.server 8751` → http://localhost:8751
- Outo-toets: `http://localhost:8751/?autotest=1` skryf resultate na `data-autotest`.
- Ikone: `python3 gen_icons.py`

Lêers in `D:\jparibix\projects\gps-speedo`
