# DreamPlayer

**Status:** first GitHub Pages demo candidate (`0.1.0`). DreamPlayer is a local, privacy-first music-to-visual cue instrument. Tiny Director lets one person trigger images and simple camera-like effects from a configurable 3×3 pad while the soundtrack continues, then replay and save the result.

![DreamPlayer Tiny Director demo](docs/Screenshot%202026-07-21%20155522.png)

## GitHub Pages demo

After the owner enables and manually deploys the included Pages workflow, the demo will be available at a project URL such as:

`https://USERNAME.github.io/tiny-director/`

Replace `USERNAME` and `tiny-director` with the actual GitHub account and repository name. No site has been published by this preparation task.

## What the demo proves

- A self-contained `.dreamcue` project can carry audio, images, image cues, effect cues and director bank assignments.
- Playback, pause, resume, restart and arbitrary seeking reconstruct the expected visual state.
- A live click or configured hotkey creates a cue without pausing the audio.
- Suggestions from the clearly labelled local AI Assist heuristic remain editable and do nothing until accepted.
- Projects open and save locally; the app has no account, upload or network-client path.

## Prerequisites

- Node.js 20 or newer
- A current desktop browser; Chromium is the primary demo target
- Audio output enabled for the browser

There are no runtime or development package dependencies to install.

## Local start

```powershell
npm start
```

Open `http://127.0.0.1:4188`. Do not open `index.html` directly because the app uses browser ES modules.

No build step is required. The documented server serves the source files directly; `npm run verify` performs validation and rebuilds the generated example.

## Two-minute demo

1. Select **Load demo**.
2. Press **Play** and watch the existing cues.
3. Open **Tiny Director** and trigger two image cells while audio continues.
4. Switch the pad to **Effects** and trigger **Zoom in** and **Move right**.
5. Seek backward and forward; image and transform state are reconstructed from the timeline.
6. Generate an AI Assist proposal, edit a time and accept one suggestion.
7. Select **Test in Player**, then **Save** to export the updated Dreamcue project.

The included sample is `examples/night-storm-demo.dreamcue`. It contains an 18-second generated WAV, five generated SVG scenes and no downloaded or personal media.

## Controls

- Player: play/pause, seek, restart and volume
- Live pad defaults: Numpad 7–9 / 4–6 / 1–3
- Alternative pad: `Q W E / A S D / Y X C`
- Bank switching defaults: Numpad Plus for previous, Numpad Minus for next
- Settings: use the gear button to select a layout or rebind every pad and bank key

Application hotkeys are ignored while an input, select, textarea or editable element has focus.

## Browser support

- **Actually tested:** the Chromium-based Codex in-app browser on Windows, including a simulated `/tiny-director/` project subpath.
- **Expected to work but not verified in this release:** current Google Chrome, Microsoft Edge, Firefox and Safari desktop versions with ES modules, Web Crypto, `<dialog>`, File API and Blob download support.
- WAV and MP3 are the safest audio choices; codec support varies by browser.

## Verify

```powershell
npm run verify
```

This checks the main scripts, runs the Node test suite, and rebuilds the generated demo. The current audited result is 31/31 passing tests; see `docs/TEST_REPORT.md` for evidence and the manual browser checklist.

## Project structure

```text
index.html, styles.css       Browser interface
src/app.js                   UI coordination
src/audio-sync.js            Audio transport and time updates
src/core/                    Project, cue, effect, bank and heuristic logic
scripts/serve.js             Loopback-only static server
scripts/build-demo-project.mjs
tests/                       Dependency-free Node tests
examples/                    Generated sample and provenance note
.github/workflows/           Manual, allowlisted GitHub Pages deployment
PRIVACY.md                   Local-data behavior
PAGES_DEPLOYMENT.md          Pages scope and owner deployment steps
```

## Dreamcue format

The current format identifier is `dreamcue/0.1-draft`. Projects are readable JSON with media embedded as Data URLs. Image cues remain in `timeline.cues`; effect cues are separate in `timeline.effectCues`; Tiny Director banks are stored under `settings.director`. Import normalization supplies these newer fields when older compatible files omit them.

The format is deliberately a draft. Do not treat it as a stable public interchange standard yet.

## Privacy and data handling

- Audio, images and projects remain on the device.
- The page contains no analytics, fetch, XHR, WebSocket, cloud or account integration.
- The local server binds to `127.0.0.1` and sends a Content Security Policy with `connect-src 'none'`. GitHub Pages necessarily serves the application files over HTTPS, but imported media is not uploaded by the application.
- Hotkey preferences are the only data stored in browser `localStorage`.
- Saving creates a local download selected by the user.

## Known limitations

- AI Assist is a deterministic local heuristic, not an OpenAI model connection.
- Raw embedded media is limited to 64 MiB; Base64 and browser decoding increase peak memory.
- Audio codec behavior varies by browser; WAV and MP3 are the safest choices.
- There is no undo history, video export, multi-track audio, cloud sync or collaboration.
- Drag-and-drop reordering is pointer-oriented.
- Automated visual-regression and cross-browser tests are not included.

## Troubleshooting

- **No audio starts:** interact with the page once, check browser/site audio permission, and verify the project contains a supported audio file.
- **A project is rejected:** use a `.dreamcue` JSON file and read the displayed validation message; missing audio, unknown cue assets and invalid JSON are rejected intentionally.
- **A hotkey does nothing:** remove focus from text fields, confirm the active bank and grid mode, then check the gear settings for conflicts.
- **An image is blank after seeking:** the timeline has no enabled image cue at or before that time; add one in Tiny Director.
- **The page fails when opened as a file:** run the local server and use the loopback URL above.

## Attribution and provenance

The included WAV and SVG demo media are generated by repository code. No third-party runtime packages or shipped third-party media were found in the audited project. Git history was not available in the supplied directory, so the owner should complete a final provenance review before distribution.

## License and reuse

No usage license has been chosen. **All rights reserved unless otherwise stated.** The presence of source code and demo assets does not grant permission to copy, modify, redistribute or commercialize them. See `LICENSE-NOT-CHOSEN.md`. The project owner must choose any future license and review applicable event/submission terms before publishing or submitting.
