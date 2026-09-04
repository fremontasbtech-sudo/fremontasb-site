import { Link } from 'react-router-dom'
import { school, links } from '../data/sources'
import logo from '../assets/fremont-tower.png'

const item = 'inline-flex min-h-[44px] items-center hover:text-brand'

export default function Footer() {
  return (
    <footer className="mt-auto border-t-4 border-brand bg-paper">
      <div className="container-site py-12 grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="md:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-10 w-auto" />
            <p className="tagline text-2xl">“{school.tagline}”</p>
          </div>
          <p className="mt-4 text-sm text-body max-w-sm">
            The Associated Student Body of Fremont High School: rallies, clubs, FremontTV, dances, and everything in between.
          </p>
          <p className="mt-3 text-sm text-body max-w-sm">
            Website designed and maintained by ASB Tech.
          </p>
        </div>
        <div className="text-sm">
          <p className="eyebrow mb-2">Find us</p>
          <address className="not-italic leading-relaxed">
            <a href={school.mapsUrl} target="_blank" rel="noopener noreferrer" className={item}>
              575 W Fremont Ave, Sunnyvale, CA 94087
            </a>
            <br />
            <a href={`mailto:${school.email}`} className={`${item} link-brand [overflow-wrap:anywhere]`}>{school.email}</a>
          </address>
        </div>
        <div className="text-sm">
          <p className="eyebrow mb-2">Follow</p>
          <ul className="grid">
            <li><a className={item} href={links.instagram} target="_blank" rel="noopener noreferrer">Instagram: @firebirdfelipe</a></li>
            <li><a className={item} href={links.tiktok} target="_blank" rel="noopener noreferrer">TikTok: @felipethefirebird</a></li>
            <li><a className={item} href={links.youtube} target="_blank" rel="noopener noreferrer">YouTube: Fremont High School ASB</a></li>
            <li><a className={item} href={links.flickr} target="_blank" rel="noopener noreferrer">Flickr: event photos</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-rule">
        <div className="container-site py-3 flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-body">
          <p className="inline-flex min-h-[44px] items-center">{school.credit}</p>
          <p className="inline-flex min-h-[44px] items-center gap-1">
            <Link to="/download-app" className="inline-flex min-h-[44px] items-center hover:text-brand">Download the App</Link> · © {new Date().getFullYear()} Fremont High School ASB
          </p>
        </div>
      </div>
    </footer>
  )
}
