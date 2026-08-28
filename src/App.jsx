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

// Route table. Add a page: create src/pages/X.jsx, import it, add a row here, add a nav link in Navbar.jsx.
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/media', element: <Media /> },
      { path: '/photos', element: <Photos /> },
      { path: '/clubs', element: <Clubs /> },
      { path: '/homecoming-court', element: <HomecomingCourt /> },
      { path: '/elections', element: <Elections /> },
      { path: '/opportunities', element: <Opportunities /> },
      { path: '/resources', element: <Resources /> },
      { path: '/contact', element: <Contact /> },
      { path: '/download-app', element: <DownloadApp /> },
      // old Wix URLs
      { path: '/fremonttv', element: <Navigate to="/media" replace /> },
      { path: '/videos', element: <Navigate to="/media" replace /> },
      { path: '*', element: <NotFound /> },
    ],
  },
], { future: { v7_relativeSplatPath: true } })

export default router
