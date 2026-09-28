import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
type ReturnPhase = 'idle' | 'preparing' | 'leaving';

function getRoute(): Route {
  if (window.location.hash === '#/projects') return 'projects';
  if (window.location.hash === '#/keyboard') return 'keyboard';
  if (window.location.hash === '#/tablet') return 'tablet';
  return 'desk';
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRoute);
  const routeRef = useRef(route);
  const [introDone, setIntroDone] = useState(route !== 'desk');
  const [deskReady, setDeskReady] = useState(false);
  const [deskIntroComplete, setDeskIntroComplete] = useState(route !== 'desk');
  const [returnPhase, setReturnPhase] = useState<ReturnPhase>('idle');

  const handleDeskReady = useCallback(() => {
    setDeskReady(true);
  }, []);

  const handleDeskIntroComplete = useCallback(() => {
    setDeskIntroComplete(true);
  }, []);

  const finishReturnToDesk = useCallback(() => {
    window.history.pushState(null, '', '#/');
    routeRef.current = 'desk';
    setRoute('desk');
    setReturnPhase('idle');
  }, []);

  const navigateToDesk = useCallback(() => {
    if (routeRef.current === 'desk' || returnPhase !== 'idle') return;
    setDeskReady(false);
    setReturnPhase('preparing');
  }, [returnPhase]);

  useEffect(() => {
    if (returnPhase !== 'preparing' || !deskReady) return;

    // Let the rendered WebGL frame reach the screen before fading the old page.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setReturnPhase('leaving'));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [deskReady, returnPhase]);

  useEffect(() => {
    const handleHashChange = () => {
      const nextRoute = getRoute();
      setReturnPhase('idle');
      routeRef.current = nextRoute;
      setRoute(nextRoute);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const routedPage = route === 'projects'
    ? <ProjectBrowserPage onBackToDesk={navigateToDesk} />
    : route === 'keyboard'
      ? (
      <Suspense fallback={<main className="keyboard-page page-shell" aria-label="키보드 페이지 로딩 중" />}>
        <KeyboardPage onBackToDesk={navigateToDesk} />
      </Suspense>
      )
      : route === 'tablet'
        ? <TabletPage onBackToDesk={navigateToDesk} />
        : null;

  const showDesk = route === 'desk' || returnPhase !== 'idle';

  return (
    <div className={`app-route-stack${returnPhase !== 'idle' ? ' is-returning-to-desk' : ''}${returnPhase === 'leaving' ? ' is-return-leaving' : ''}`}>
      {showDesk && (
        <div className="app-route-layer app-route-layer--desk" key="desk">
          <Suspense fallback={null}>
            <DeskPage
              introActive={introDone && !deskIntroComplete}
              introComplete={deskIntroComplete}
              onIntroComplete={handleDeskIntroComplete}
              onReady={handleDeskReady}
            />
          </Suspense>
          {!introDone && (
            <IntroPage ready={deskReady} onFinish={() => setIntroDone(true)} />
          )}
        </div>
      )}
      {route !== 'desk' && (
        <div
          className="app-route-layer app-route-layer--source"
          key={route}
          onAnimationEnd={(event) => {
            if (returnPhase === 'leaving' && event.target === event.currentTarget) finishReturnToDesk();
          }}
        >
          {routedPage}
        </div>
      )}
    </div>
  );
}
