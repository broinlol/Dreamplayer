# Privacy

DreamPlayer and Tiny Director process imported audio, images and Dreamcue projects locally in the browser.

- The application contains no account, analytics, advertising, tracker, upload endpoint, `fetch`, XHR or WebSocket integration.
- Imported media is read into browser memory and embedded in the in-memory Dreamcue project. The application does not send that media to a server.
- Saving creates a Dreamcue JSON download locally through the browser's Blob download API.
- Hotkey preferences are stored in browser `localStorage` for the current site origin. Media and projects are not stored there.
- Opening the GitHub Pages demo necessarily requests the application files from GitHub's hosting infrastructure. GitHub may process normal web-hosting request information under its own policies; this project adds no tracking.
- A user can inspect or clear site storage through the browser and can close or reload the page to release in-memory project data.

This description reflects the audited Demo 0.1 source. It should be reviewed again if networking, cloud storage, external models, analytics or accounts are added later.
