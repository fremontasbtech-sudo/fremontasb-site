import PageHero from '../components/PageHero'
import { school } from '../data/sources'

/** Privacy - plain-language notice. Linked from the footer and from Google's sign-in consent screen. */
export default function Privacy() {
  return (
    <>
      <PageHero title="Privacy" subtext="What this website collects, and what it doesn't." />
      <section className="container-site section-space">
        <div className="mx-auto max-w-xl space-y-5 leading-relaxed text-body">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Browsing the site</h2>
          <p>
            You can read everything on fremontasb.org without an account. We don&rsquo;t sell data, run ads, or use
            tracking cookies. Your browser may save small settings on your own device (like the language you picked, or
            a copy of the latest news so pages load faster).
          </p>

          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Sign in with Google (nominations and voting)</h2>
          <p>
            Some ASB forms, like Homecoming Court nominations, ask you to sign in with your school Google account so each
            student gets exactly one say. When you sign in, Google tells us only your name and school email address. We
            never see your password and get no access to your Google Drive, Gmail, or anything else in your account.
          </p>
          <p>
            We store your school email next to what you submitted (for example, your nominees) in an ASB Google Sheet.
            Only ASB advisors and ASB Tech can see it, it&rsquo;s used only to count one entry per student, and it is
            deleted after that event&rsquo;s results are final. Your name and email are never shown publicly.
          </p>

          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Questions</h2>
          <p>
            Email <a href={`mailto:${school.email}`} className="link-brand [overflow-wrap:anywhere]">{school.email}</a> and
            we&rsquo;ll answer, or remove something you submitted.
          </p>
        </div>
      </section>
    </>
  )
}
