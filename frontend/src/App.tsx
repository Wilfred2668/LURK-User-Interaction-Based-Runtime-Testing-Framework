import { useState, useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout.js';
import { OverviewPage } from './pages/OverviewPage.js';
import { SessionsPage } from './pages/SessionsPage.js';
import { SessionDetailPage } from './pages/SessionDetailPage.js';
import { AnalysisSelectionPage } from './pages/AnalysisSelectionPage.js';
import { WebsiteDetailPage } from './pages/WebsiteDetailPage.js';
import { PageAnalysisPage } from './pages/PageAnalysisPage.js';
import { SettingsPage } from './pages/SettingsPage.js';

export function App() {
  const getInitialUrl = () => {
    // If hash was used, convert cleanly to path + search
    if (window.location.hash) {
      const h = window.location.hash.slice(1);
      return h.startsWith('/') ? h : `/${h}`;
    }
    const full = `${window.location.pathname}${window.location.search}`;
    return full || '/';
  };

  const [currentUrl, setCurrentUrl] = useState<string>(getInitialUrl);

  useEffect(() => {
    const handlePopState = () => {
      const full = `${window.location.pathname}${window.location.search}`;
      if (window.location.hash) {
        const h = window.location.hash.slice(1);
        setCurrentUrl(h.startsWith('/') ? h : `/${h}`);
      } else {
        setCurrentUrl(full || '/');
      }
    };

    const handleHashChange = () => {
      if (window.location.hash) {
        const h = window.location.hash.slice(1);
        setCurrentUrl(h.startsWith('/') ? h : `/${h}`);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const navigate = (url: string) => {
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    if (`${window.location.pathname}${window.location.search}` !== cleanUrl) {
      window.history.pushState(null, '', cleanUrl);
    }
    setCurrentUrl(cleanUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Routing Resolver supporting both query params and legacy paths
  const renderRoute = () => {
    const raw = currentUrl.startsWith('/') ? currentUrl : `/${currentUrl}`;
    const urlObj = new URL(`http://localhost${raw}`);
    const pathname = urlObj.pathname;
    const params = urlObj.searchParams;

    // 1. Settings (/settings)
    if (pathname === '/settings') {
      return <SettingsPage />;
    }

    // 2. Sessions List (/sessions)
    if (pathname === '/sessions') {
      return <SessionsPage onNavigate={navigate} />;
    }

    // 3. Page Diagnostics (/page?sessionId=...&websiteId=...&pageId=... OR legacy /sessions/:s/websites/:w/pages/:p)
    if (pathname === '/page' || pathname.includes('/pages/')) {
      const sessionId = params.get('sessionId') || params.get('session');
      const websiteId = params.get('websiteId') || params.get('website');
      const pageId = params.get('pageId') || params.get('page');

      if (sessionId && websiteId && pageId) {
        return (
          <PageAnalysisPage
            sessionId={sessionId}
            websiteId={websiteId}
            pageId={pageId}
            onNavigate={navigate}
          />
        );
      }

      const match = pathname.match(/^\/sessions\/([^/]+)\/websites\/([^/]+)\/pages\/([^/]+)$/);
      if (match) {
        return (
          <PageAnalysisPage
            sessionId={match[1]!}
            websiteId={match[2]!}
            pageId={match[3]!}
            onNavigate={navigate}
          />
        );
      }
    }

    // 4. Analysis Selection (/analyze?sessionId=...[&websiteId=...] OR legacy /sessions/:s/.../analyze)
    if (pathname === '/analyze' || pathname.endsWith('/analyze')) {
      const sessionId = params.get('sessionId') || params.get('session');
      const websiteId = params.get('websiteId') || params.get('website') || undefined;

      if (sessionId) {
        return (
          <AnalysisSelectionPage
            sessionId={sessionId}
            websiteId={websiteId}
            onNavigate={navigate}
          />
        );
      }

      const matchWeb = pathname.match(/^\/sessions\/([^/]+)\/websites\/([^/]+)\/analyze$/);
      if (matchWeb) {
        return (
          <AnalysisSelectionPage
            sessionId={matchWeb[1]!}
            websiteId={matchWeb[2]!}
            onNavigate={navigate}
          />
        );
      }

      const matchSess = pathname.match(/^\/sessions\/([^/]+)\/analyze$/);
      if (matchSess) {
        return (
          <AnalysisSelectionPage
            sessionId={matchSess[1]!}
            onNavigate={navigate}
          />
        );
      }
    }

    // 5. Website Detail (/website?sessionId=...&websiteId=... OR legacy /sessions/:s/websites/:w)
    if (pathname === '/website' || (pathname.includes('/websites/') && !pathname.endsWith('/analyze'))) {
      const sessionId = params.get('sessionId') || params.get('session');
      const websiteId = params.get('websiteId') || params.get('website') || params.get('id');

      if (sessionId && websiteId) {
        return (
          <WebsiteDetailPage
            sessionId={sessionId}
            websiteId={websiteId}
            onNavigate={navigate}
          />
        );
      }

      const match = pathname.match(/^\/sessions\/([^/]+)\/websites\/([^/]+)$/);
      if (match) {
        return (
          <WebsiteDetailPage
            sessionId={match[1]!}
            websiteId={match[2]!}
            onNavigate={navigate}
          />
        );
      }
    }

    // 6. Session Detail (/session?id=... OR legacy /sessions/:s)
    if (pathname === '/session' || (pathname.startsWith('/sessions/') && pathname.split('/').length === 3)) {
      const sessionId = params.get('id') || params.get('sessionId') || params.get('session');
      if (sessionId) {
        return (
          <SessionDetailPage
            sessionId={sessionId}
            onNavigate={navigate}
          />
        );
      }

      const match = pathname.match(/^\/sessions\/([^/]+)$/);
      if (match) {
        return (
          <SessionDetailPage
            sessionId={match[1]!}
            onNavigate={navigate}
          />
        );
      }
    }

    // Fallback Overview (/)
    return <OverviewPage onNavigate={navigate} />;
  };

  return (
    <AppLayout currentPath={currentUrl} onNavigate={navigate}>
      {renderRoute()}
    </AppLayout>
  );
}
export default App;
