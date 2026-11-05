# waffengebraucht.at-enhancer

> Inoffizielles Zusatz-Tool, nicht mit waffengebraucht.at verbunden.

Tampermonkey-Userscript, das [waffengebraucht.at](https://www.waffengebraucht.at) um Filter, Sortierung und eine übersichtlichere Oberfläche erweitert.

Die Seite hat nur eine Textsuche. Dieses Script lädt alle Ergebnisseiten im Hintergrund und legt eine Filter-Oberfläche darüber, damit man nicht mehr Seite für Seite durchblättern muss.

## Features

**Filter**

- Preis von/bis, optional Inserate ohne Preis ausblenden
- Anbieter: Privat oder Händler
- Art: Angebote, Gesuche oder beides
- Zeitraum: 24 Stunden bis 90 Tage
- Ort (mehrere mit Komma, z. B. `Graz, Wien, Kärnten`) mit Autovervollständigung
- Kaliber als Chips mit Trefferzahl, automatisch aus dem Titel erkannt (.22 lr, 9x19, .308, 12/70 usw.)
- Kategorie als Chips mit Trefferzahl
- Suche im Ergebnis, mit `-wort` zum Ausschließen und `"cz 75"` für Phrasen. Taste `/` springt ins Suchfeld.
- Doppelte Inserate und Verkauft/Reserviert ausblenden

**Ansicht**

- Karten- oder Tabellenansicht
- Seitenweise Anzeige mit Seitennavigation (24, 48, 96 oder 200 Einträge pro Seite, Auswahl wird gemerkt)
- Sortierung nach Datum, Preis, Titel oder Ort
- Median und typische Preisspanne der aktuellen Treffer
- „NEU"-Markierung für Inserate seit deinem letzten Besuch
- Einzelne Inserate mit dem × ausblenden (und wieder einblenden)
- Aktive Filter als Chips, per Klick entfernbar
- Schlanke, fixierte Kopfleiste mit Menü, Suche und Kategorie-Navigation. Die Werbebanner der Seite bleiben sichtbar, werden aber als kompakte „Anzeige"-Karte unter der Kategorie-Leiste dargestellt statt als großer Block. Sie lassen sich per Link „Anzeigen ausblenden" wegklappen.
- Responsive, auch am Handy nutzbar

## Installation

1. [Tampermonkey](https://www.tampermonkey.net/) im Browser installieren.
2. Die Datei [`waffengebraucht-enhancer.user.js`](waffengebraucht-enhancer.user.js) öffnen und auf „Raw" klicken. Tampermonkey bietet die Installation automatisch an.
3. Waffengebraucht.at neu laden, fertig.

## Benutzung

- Die Oberfläche erscheint automatisch auf Suchergebnissen und Kategorieseiten (z. B. `/suche/…`, `/waffen`, `/waffen/pistolen`). Der neue Kopfbereich gilt auf allen Seiten.
- Beim ersten Aufruf werden bis zu 60 Seiten geladen (rund 1.200 Inserate). Bei größeren Kategorien lädt „Weitere 60 Seiten laden" den Rest nach.
- „Neu laden" holt die Inserate frisch. Sonst werden die Ergebnisse 10 Minuten zwischengespeichert, damit Zurückblättern schnell geht.
- „Breit" blendet die Original-Seitenleisten ein oder aus.

## Datenschutz und Hinweise

- Alles läuft lokal im Browser. Es werden keine Daten an Dritte gesendet.
- Gespeichert wird nur im `localStorage` und `sessionStorage` des Browsers: deine Filter pro Suche, ausgeblendete Inserate, die „NEU"-Markierung, die Anzeigen-Einstellung und der Zwischenspeicher.
- Das Script ruft ausschließlich öffentliche Seiten von waffengebraucht.at ab, mit höchstens 4 gleichzeitigen Anfragen, und nur, wenn du eine Listenseite öffnest.
- Die Kaliber-Erkennung basiert auf Mustern im Inseratstitel. Sie kann bei ungewöhnlichen Titeln danebenliegen. Neue Muster lassen sich in der Liste `CAL` im Script ergänzen.
- Das Script hängt vom aktuellen HTML-Aufbau der Seite ab. Wenn die Seite ihr Layout ändert, muss es angepasst werden.
- Dieses Projekt ist inoffiziell und steht in keiner Verbindung zu waffengebraucht.at oder dessen Betreiber. Alle Namen und Marken gehören ihren jeweiligen Inhabern.

## Lizenz

[MIT](LICENSE)
