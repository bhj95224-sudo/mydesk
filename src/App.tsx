import { useEffect, useState } from 'react';
import { DeskPage } from './pages/DeskPage';
import { ProjectBrowserPage } from './pages/ProjectBrowserPage';

type Route = 'desk' | 'projects';

function getRoute(): Route {
  return window.location.hash === '#/projects' ? 'projects' : 'desk';
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRoute);

  useEffect(() => {
    const handleHashChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return route === 'projects' ? <ProjectBrowserPage /> : <DeskPage />;
}
