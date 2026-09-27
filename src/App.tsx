import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { IntroPage } from './pages/IntroPage';
import { ProjectBrowserPage } from './pages/ProjectBrowserPage';
import { TabletPage } from './pages/TabletPage';

const DeskPage = lazy(() =>
  import('./pages/DeskPage').then((module) => ({ default: module.DeskPage })),
);
const KeyboardPage = lazy(() =>
  import('./pages/KeyboardPage').then((module) => ({ default: module.KeyboardPage })),
);

type Route = 'desk' | 'keyboard' | 'projects' | 'tablet';

function getRoute(): Route {
  if (window.location.hash === '#/projects') return 'projects';
  if (window.location.hash === '#/keyboard') return 'keyboard';
  if (window.location.hash === '#/tablet') return 'tablet';
  return 'desk';
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRoute);
  const [introDone, setIntroDone] = useState(false);
  const [deskReady, setDeskReady] = useState(false);

  const handleDeskReady = useCallback(() => {
    setDeskReady(true);
  }, []);

  useEffect(() => {
    const handleHashChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (route === 'projects') return <ProjectBrowserPage />;
  if (route === 'keyboard') {
    return (
      <Suspense fallback={<main className="keyboard-page page-shell" aria-label="키보드 페이지 로딩 중" />}>
        <KeyboardPage />
      </Suspense>
    );
  }
  if (route === 'tablet') return <TabletPage />;
  return (
    <>
      <Suspense fallback={null}>
        <DeskPage onReady={handleDeskReady} />
      </Suspense>
      {!introDone && (
        <IntroPage ready={deskReady} onFinish={() => setIntroDone(true)} />
      )}
    </>
  );
}
