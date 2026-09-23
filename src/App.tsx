import { useEffect, useState } from 'react';
import { DeskPage } from './pages/DeskPage';
import { IntroPage } from './pages/IntroPage';
import { KeyboardPage } from './pages/KeyboardPage';
import { ProjectBrowserPage } from './pages/ProjectBrowserPage';
import { TabletPage } from './pages/TabletPage';

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

  useEffect(() => {
    const handleHashChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (route === 'desk' && !introDone) return <IntroPage onFinish={() => setIntroDone(true)} />;
  if (route === 'projects') return <ProjectBrowserPage />;
  if (route === 'keyboard') return <KeyboardPage />;
  if (route === 'tablet') return <TabletPage />;
  return <DeskPage />;
}
