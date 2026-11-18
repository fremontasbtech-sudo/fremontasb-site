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
            You can read everything on fremontasb.org without an account. We don&rsquo;t sell data or run ads. Your
            browser may save small settings on your own device (like the language you picked, or a copy of the latest
            news so pages load faster).
          </p>
          <p>
            We use Google Analytics to count visits and see which pages and links people use. It sets a cookie that
            tells one visit from another, but it never receives your name, your email, or anything you type into a form.
            Google&rsquo;s advertising and ad personalization features are turned off.
          </p>

          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Sign in with Google (nominations and voting)</h2>
          <p>
            Some ASB forms, like Homecoming Court nominations, ask you to sign in with your school Google account so each
            student gets exactly one say. When you sign in, Google tells us only your name and school email address. We
            never see your password and get no access to your Google Drive, Gmail, or anything else in your account.
          </p>
          <p>
            We store your school email next to what you submitted (for example, your nominees) in a private ASB Google
            Sheet. Only ASB officers (the student leaders in ASB) and ASB advisors can open it. We use it only to count
            one entry per student and to tally the results, and your name and email are never shown publicly.
          </p>

          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">The contact form</h2>
          <p>
            You don&rsquo;t need to sign in to send us a message. When you use the form on the Contact page, we save your
            name, the email you give us, and your message in a private ASB Google Sheet. Only ASB officers and ASB
            advisors can open it. We use it only to read your message and reply to you, and we never share it or show it
            publicly.
          </p>

          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Ask Felipe in the Firebird Hub app</h2>
          <p>
            Ask Felipe answers questions in the Firebird Hub app. Simple questions, like what period it is or when the next game is, are answered on your own device from the app&rsquo;s data and are not sent anywhere.
          </p>
          <p>
            Other questions are sent to Google&rsquo;s Gemini AI service so it can write an answer. We send your question, your last few messages in that chat, and the language you picked. If you have connected Schoology and your question is about your assignments, we also send the title, type, due date and short description of the matching assignments, up to 12 of them. We never send your name, your email, or your Schoology calendar link.
          </p>
          <p>
            We don&rsquo;t save your questions, Felipe&rsquo;s answers or your assignments, and no one at ASB reads them. Google handles them under its Gemini API terms and may use them to improve its services. Please don&rsquo;t type private information, like passwords, grades or other students&rsquo; details, into Ask Felipe.
          </p>

          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Questions</h2>
          <p>
            Email us at <a href={`mailto:${school.email}`} className="link-brand [overflow-wrap:anywhere]">{school.email}</a> and
            we&rsquo;ll answer, or remove something you submitted.
          </p>
        </div>
      </section>
    </>
  )
}
