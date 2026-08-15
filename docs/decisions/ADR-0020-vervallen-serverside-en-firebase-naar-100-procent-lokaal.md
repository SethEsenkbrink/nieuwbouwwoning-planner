# ADR-0020 — Vervallen serverside laag en Firebase: 100% lokaal en versleuteld

**Status:** Geaccepteerd  
**Datum:** 2026-08-15  
**Herziet:** ADR-0005, ADR-0006, ADR-0010

## Context

De initiële architectuur van Nieuwbouwplanner leunde op Firebase (Auth en Firestore) met
serverside functies op Netlify Functions. Dit bracht een aantal fundamentele nadelen mee:
- Externe data-afhankelijkheid en netwerkvereisten bij het openen en gebruiken van het dossier.
- Privacyrisico's rondom gevoelige woning-, financiële en persoonsgegevens op servers van derden.
- Complexiteit rondom Firestore security rules, emulators en quota.
- Beperkingen op mobiel en offline scenario's.

Het project wordt herpositioneerd en herbouwd tot **Woningdossier**: een 100% lokale,
end-to-end versleutelde Progressive Web App (PWA) voor het volledige leven van een woning
(zowel nieuwbouw als bestaande bouw).

## Beslissing

1. **Volledig lokaal (Local-first & Zero-network):**
   - Firebase (Auth, Firestore) en Netlify Functions worden volledig verwijderd.
   - Netlify dient uitsluitend als statische webhosting.
   - De browser Content-Security-Policy (CSP) wordt dichtgezet met `connect-src 'none'`.
   - Nul uitgaande netwerkverzoeken tijdens gebruik. Alle assets, fonts en scripts zijn self-hosted.

2. **Opslagarchitectuur:**
   - **Dexie (IndexedDB):** Voor alle gestructureerde metadata, entiteiten en records.
   - **Origin Private File System (OPFS):** Voor versleutelde bestands- en fotoblobs, versleuteld in chunks van 1 MiB via Web Crypto (AES-256-GCM).
   - Grote blobs worden nooit direct door de React component-state getrokken.

3. **Kluis en Encryptie:**
   - Eén master Data Encryption Key (DEK, 256-bit AES-GCM non-extractable CryptoKey) die uitsluitend in het geheugen leeft.
   - Ingepakt met KEK-A (Argon2id uit passphrase) en KEK-C (HKDF uit 128-bit herstelcode).

4. **Offline PWA:**
   - Geconfigureerd met `vite-plugin-pwa` voor een volledige offline app-shell.
   - Volledig functioneel in vliegtuigmodus.

5. **Desktop/Mobiel model:**
   - Desktop (Chromium File System Access API) is de volledige beheeromgeving en bron van waarheid met automatische backup naar een gekozen map.
   - Mobiel fungeert als companion (read-only snapshot viewer + inbox-delta export). Geen live synchronisatie.

## Gevolgen

**Positief:**
- Maximale privacy en soevereiniteit: data verlaat het apparaat nooit.
- Geen cloud-kosten, geen rate limits, geen vendor lock-in.
- Directe, razendsnelle laadtijden en gegarandeerde werking zonder internetverbinding.
- Geen serverside code of databases meer te onderhouden of te beveiligen.

**Negatief:**
- Geen automatische realtime multi-device sync via de cloud; synchronisatie verloopt via backups/snapshots en inbox-delta bestanden.
- Dataverliespreventie leunt volledig op de lokale backup-engine en de verantwoordelijkheid van de gebruiker (ondersteund door actieve backup-herinneringen en directory handle exports).
