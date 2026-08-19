# Layer 1 — Browser Telemetry Extension

Manifest V3 Chrome extension that captures in-browser runtime events, user interactions, and performance telemetry during testing sessions.

---

## Overview
- **User Interactions**: Captures user clicks and form interactions to establish correlation between user actions and resulting errors.
- **Console Errors**: Intercepts unhandled JavaScript exceptions, runtime errors, and console warnings.
- **Network Traffic**: Monitors Fetch and XHR requests, response status codes, failures, and network durations.
- **Main-Thread Performance**: Records browser long tasks (>50ms) and Web Vitals (LCP, CLS, FID/INP).
- **Navigation & Routing**: Tracks multi-page transitions and Single Page Application (SPA) `pushState` / `popstate` route changes.

---

## Build & Installation

```bash
# 1. Install dependencies
npm install

# 2. Build the extension bundle (outputs to /dist)
npm run build
```

### Loading in Google Chrome
1. Open Chrome and navigate to `chrome://extensions`.
2. Turn ON **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/dist` folder.
4. Open any website, click the LURK extension icon, and click **Start Monitoring**.
5. Once done, click **Stop & Finalize** to package and persist the session.
