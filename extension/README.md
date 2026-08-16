# Runtime Monitoring Extension - Milestone 1A

This project is the first milestone of a Chrome extension for runtime monitoring. It covers the extension foundation, session creation, page tracking, and persistent active-session state.

Note: The active monitoring session uses `chrome.storage.local` so it persists across popup reopening, service-worker restarts, extension reloads, and browser restarts where Chrome preserves extension local storage. IndexedDB will later be used for high-volume runtime event storage. `chrome.storage.session` is not used for active-session persistence.

## 1. Install the extension locally in Chrome

1. Ensure dependencies are installed:
   ```bash
   npm install
   ```
2. Build the extension:
   ```bash
   npm run build
   ```
3. Open Chrome and navigate to:
   ```text
   chrome://extensions
   ```
4. Enable Developer Mode.
5. Click Load unpacked.
6. Select the generated `dist` folder from this project.

## 2. Start the extension in development mode

Run:
```bash
npm run build
```

This builds the extension bundle into the `dist` directory.

## 3. Reload the extension after changes

1. Open `chrome://extensions`.
2. Find the Runtime Monitoring Extension card.
3. Click the reload icon for the extension.

You can also rebuild with:
```bash
npm run build
```

## 4. Open the extension service-worker console

1. Visit `chrome://extensions`.
2. Find the Runtime Monitoring Extension.
3. Click Service worker under the extension details.
4. The Chrome DevTools console for the service worker will open.

Useful debug command in the console:
```js
__runtimeSessionDebug()
```

## 5. How to test Start/Stop Session

1. Load the unpacked extension.
2. Open a normal web page such as `https://example.com`.
3. Click the extension icon.
4. Click Start Monitoring.
5. Confirm the popup shows:
   - monitoring as ACTIVE
   - a generated `sess_...` session ID
   - a current page ID
   - the current page URL
6. Click Stop Monitoring.
7. Confirm the popup returns to the Start Monitoring state.
8. Start a new session again and verify a different session ID is generated.

## 6. Page lifecycle behavior for Milestone 1B

This milestone keeps the active monitoring session in `chrome.storage.local` and makes page tracking tab-aware.

- A new monitoring session creates a single initial page for the active supported tab.
- When that tab navigates to a new document, a new `pageId` is created while preserving the same `sessionId` and `tabId`.
- Switching tabs updates the active-tab tracking without creating a duplicate page for already-tracked pages.
- Closing a tracked tab preserves its historical pages while clearing only the active-tab reference as needed.
- Duplicate navigation lifecycle events are ignored if the tracked page already matches the current URL.
- Unsupported internal Chrome pages are ignored.

## 7. SPA route and navigation tracking for Milestone 1C

This milestone adds route-aware navigation tracking while preserving the browser document/page model.

- Browser document/page identity remains as `PageRecord`.
- Application navigation events are recorded as `RouteRecord` entries associated with the active page.
- A real browser document navigation still creates a new page and a new initial route.
- `history.pushState`, `history.replaceState`, `popstate`, and `hashchange` create route records without creating a new page.
- Page URLs are normalized to remove only the URL fragment/hash for document identity.
- Route URLs preserve the full URL including the hash when relevant.
- The active monitoring session continues to use `chrome.storage.local`.
- IndexedDB remains reserved for later runtime event storage.

## 8. Known limitations of this milestone

- No console, network, DOM, accessibility, or performance monitoring yet.
- No backend or AI integration.
- No report generation or dashboard.
- This milestone intentionally focuses on browser-level SPA navigation tracking only.
- Active session state is stored in `chrome.storage.local` and is intentionally separate from future IndexedDB event storage.
