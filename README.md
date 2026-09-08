# aerus-portal

The homepage is a static, voice-first TappyThing experience served from the repository root `index.html` on Netlify. In browsers that support the Web Speech API (for example, recent Chromium-based browsers), the mic button captures speech and sends the recognized transcript through the existing intake flow; when speech recognition is unavailable or blocked, the page falls back gracefully to the secondary text composer.
