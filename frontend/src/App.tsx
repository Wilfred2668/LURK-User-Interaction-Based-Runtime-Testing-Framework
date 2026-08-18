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
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.hash ? window.location.hash.slice(1) : '/';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash ? window.location.hash.slice(1) : '/';
      setCurrentPath(hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Routing Resolver
  const renderRoute = () => {
    // 1. Root Overview (/)
    if (currentPath === '' || currentPath === '/') {
      return <OverviewPage onNavigate={navigate} />;
    }

    // 2. Settings (/settings)
    if (currentPath === '/settings') {
      return <SettingsPage />;
    }

    // 3. Sessions List (/sessions)
    if (currentPath === '/sessions') {
      return <SessionsPage onNavigate={navigate} />;
    }

    // 4. Page Analysis (/sessions/:sessionId/websites/:websiteId/pages/:pageId)
    const pageAnalysisMatch = currentPath.match(
      /^\/sessions\/([^/]+)\/websites\/([^/]+)\/pages\/([^/]+)$/
    );
    if (pageAnalysisMatch) {
      const [, sessionId, websiteId, pageId] = pageAnalysisMatch;
      return (
        <PageAnalysisPage
          sessionId={sessionId!}
          websiteId={websiteId!}
          pageId={pageId!}
          onNavigate={navigate}
        />
      );
    }

    // 5. Website-Scoped Analysis Selection (/sessions/:sessionId/websites/:websiteId/analyze)
    const websiteAnalyzeMatch = currentPath.match(
      /^\/sessions\/([^/]+)\/websites\/([^/]+)\/analyze$/
    );
    if (websiteAnalyzeMatch) {
      const [, sessionId, websiteId] = websiteAnalyzeMatch;
      return (
        <AnalysisSelectionPage
          sessionId={sessionId!}
          websiteId={websiteId!}
          onNavigate={navigate}
        />
      );
    }

    // 6. Website Detail (/sessions/:sessionId/websites/:websiteId)
    const websiteMatch = currentPath.match(/^\/sessions\/([^/]+)\/websites\/([^/]+)$/);
    if (websiteMatch) {
      const [, sessionId, websiteId] = websiteMatch;
      return (
        <WebsiteDetailPage
          sessionId={sessionId!}
          websiteId={websiteId!}
          onNavigate={navigate}
        />
      );
    }

    // 7. Global Session Analysis Selection (/sessions/:sessionId/analyze)
    const analyzeMatch = currentPath.match(/^\/sessions\/([^/]+)\/analyze$/);
    if (analyzeMatch) {
      const [, sessionId] = analyzeMatch;
      return (
        <AnalysisSelectionPage
          sessionId={sessionId!}
          onNavigate={navigate}
        />
      );
    }

    // 8. Session Detail (/sessions/:sessionId)
    const sessionMatch = currentPath.match(/^\/sessions\/([^/]+)$/);
    if (sessionMatch) {
      const [, sessionId] = sessionMatch;
      return (
        <SessionDetailPage
          sessionId={sessionId!}
          onNavigate={navigate}
        />
      );
    }

    // Fallback Overview
    return <OverviewPage onNavigate={navigate} />;
  };

  return (
    <AppLayout currentPath={currentPath} onNavigate={navigate}>
      {renderRoute()}
    </AppLayout>
  );
}
export default App;
