import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { IntroPage, LOADING_TEXT } from './pages/IntroPage';
import { ProjectBrowserPage } from './pages/ProjectBrowserPage';
import { TabletPage } from './pages/TabletPage';
import { DeskBrightnessLab } from './pages/DeskBrightnessLab';
const DeskPage = lazy(() =>
  import('./pages/DeskPage').then((module) => ({ default: module.DeskPage })),
);
const KeyboardPage = lazy(() =>
  import('./pages/KeyboardPage').then((module) => ({ default: module.KeyboardPage })),
);

type Route = 'desk' | 'keyboard' | 'projects' | 'tablet';
type ReturnPhase = 'idle' | 'preparing' | 'leaving';

const RETURN_LOADING_TEXT: Record<Exclude<Route, 'desk'>, string> = {
  projects: LOADING_TEXT.backFromProjects,
  keyboard: LOADING_TEXT.backFromKeyboard,
  tablet: LOADING_TEXT.backFromTablet,
};

function getRoute(): Route {
  if (window.location.hash === '#/projects') return 'projects';
  if (window.location.hash === '#/keyboard') return 'keyboard';
  if (window.location.hash === '#/tablet') return 'tablet';
  return 'desk';
}

export default function App() {
  // Standalone throwaway tool, kept out of the real route/intro state machine below --
  // see DeskBrightnessLab.tsx.
  if (window.location.hash === '#/lab') return <DeskBrightnessLab />;
  return <AppRoutes />;
}

function AppRoutes() {
  const [route, setRoute] = useState<Route>(getRoute);
  const routeRef = useRef(route);
  const [introDone, setIntroDone] = useState(route !== 'desk');
  const [deskReady, setDeskReady] = useState(false);
  const [deskIntroComplete, setDeskIntroComplete] = useState(route !== 'desk');
  const [returnPhase, setReturnPhase] = useState<ReturnPhase>('idle');
  // Loading screen shown while returning to the desk; its text depends on the page left.
  const [returnLoaderText, setReturnLoaderText] = useState<string | null>(null);
  const [projectEntryLoading, setProjectEntryLoading] = useState(false);

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
    setReturnLoaderText(RETURN_LOADING_TEXT[routeRef.current]);
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
      if (nextRoute !== 'projects') setProjectEntryLoading(false);
      // A return loader waits for the desk; drop it if browser nav went somewhere else.
      if (nextRoute !== 'desk') setReturnLoaderText(null);
      routeRef.current = nextRoute;
      setRoute(nextRoute);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const routedPage = route === 'projects'
    ? <ProjectBrowserPage onBackToDesk={navigateToDesk} entryLoaderVisible={projectEntryLoading} />
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
              onProjectNavigationStart={() => setProjectEntryLoading(true)}
            />
          </Suspense>
          {!introDone && (
            <IntroPage text={LOADING_TEXT.desk} ready={deskReady} onFinish={() => setIntroDone(true)} />
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
      {returnLoaderText && (
        // Covers the whole swap; only leaves once the desk has finished taking over.
        <IntroPage
          key="return-loader"
          text={returnLoaderText}
          fadeIn
          ready={route === 'desk' && returnPhase === 'idle' && deskReady}
          onFinish={() => setReturnLoaderText(null)}
        />
      )}
      {projectEntryLoading && (
        <IntroPage
          text={LOADING_TEXT.projects}
          ready={route === 'projects'}
          onFinish={() => setProjectEntryLoading(false)}
        />
      )}
    </div>
  );
}
