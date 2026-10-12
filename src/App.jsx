import { createBrowserRouter, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Media from './pages/Media'
import Photos from './pages/Photos'
import Clubs from './pages/Clubs'
import HomecomingCourt from './pages/HomecomingCourt'
import Elections from './pages/Elections'
import Opportunities from './pages/Opportunities'
import Resources from './pages/Resources'
import Contact from './pages/Contact'
import DownloadApp from './pages/DownloadApp'
import NotFound from './pages/NotFound'
import Privacy from './pages/Privacy'

// Route table. Add a page: create src/pages/X.jsx, import it, add a row here (handle.title is the tab title,
// read by Layout.jsx), add a nav link in Navbar.jsx, and add its URL to public/sitemap.xml.
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/media', element: <Media />, handle: { title: 'Media' } },
      { path: '/photos', element: <Photos />, handle: { title: 'Photos' } },
      { path: '/clubs', element: <Clubs />, handle: { title: 'Clubs' } },
      { path: '/homecoming-court', element: <HomecomingCourt />, handle: { title: 'Homecoming Court' } },
      { path: '/elections', element: <Elections />, handle: { title: 'Elections' } },
      { path: '/opportunities', element: <Opportunities />, handle: { title: 'Opportunities' } },
      { path: '/resources', element: <Resources />, handle: { title: 'Resources' } },
      { path: '/contact', element: <Contact />, handle: { title: 'Contact' } },
      { path: '/download-app', element: <DownloadApp />, handle: { title: 'Download the App' } },
      { path: '/privacy', element: <Privacy />, handle: { title: 'Privacy' } },
      // old Wix URLs
      { path: '/fremonttv', element: <Navigate to="/media" replace /> },
      { path: '/videos', element: <Navigate to="/media" replace /> },
      // notFound: Layout drops the canonical link and adds noindex (the server still answers 200).
      { path: '*', element: <NotFound />, handle: { title: 'Page not found', notFound: true } },
    ],
  },
], { future: { v7_relativeSplatPath: true } })

export default router
