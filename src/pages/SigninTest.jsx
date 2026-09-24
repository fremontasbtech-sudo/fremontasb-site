import { useEffect, useRef, useState } from 'react'

/**
 * /signin-test — one-off check: can an FUHSD student account use "Sign in with Google" on
 * fremontasb.org? (FUHSD blocks students from some outside apps; this proves it either way before
 * we build nominations on top of it.) Open /signin-test?client_id=<OAuth Web client ID>, click the
 * button with a @student.fuhsd.org account. Nothing is stored or sent anywhere — the page only
 * decodes the token Google hands back and shows who Google says you are.
 */
const decode = (jwt) => {
  try {
    const b = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(escape(atob(b))))
  } catch { return null }
}

export default function SigninTest() {
  const btnRef = useRef(null)
  const [clientId] = useState(() => new URLSearchParams(location.search).get('client_id') || '')
  const [who, setWho] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex'; document.head.appendChild(meta)
    if (!clientId) return () => meta.remove()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true
    s.onload = () => {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          hd: 'student.fuhsd.org',
          callback: (r) => { const p = decode(r.credential); p ? setWho(p) : setErr('Could not read the token.') },
        })
        window.google.accounts.id.renderButton(btnRef.current, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 300 })
      } catch (e) { setErr(String(e)) }
    }
    s.onerror = () => setErr('Google sign-in script failed to load (network or filter).')
    document.head.appendChild(s)
    return () => { meta.remove(); s.remove() }
  }, [clientId])

  const ok = who && who.email_verified && /@student\.fuhsd\.org$|@fuhsd\.org$/i.test(who.email || '')
  return (
    <section className="container-site section-space">
      <div className="mx-auto max-w-xl">
        <p className="eyebrow mb-2">ASB Tech · internal check</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">School sign-in test</h1>
        <div className="rule-accent-left" />
        {!clientId ? (
          <p className="mt-5 text-body">Add <code>?client_id=YOUR_CLIENT_ID</code> to the URL.</p>
        ) : (
          <div className="card-surface mt-6 p-6">
            <p className="text-body">Sign in with your <strong>@student.fuhsd.org</strong> account.</p>
            <div ref={btnRef} className="mt-4 min-h-[44px]" />
            {err && <p className="mt-4 text-sm text-brand" role="alert">{err}</p>}
            {who && (
              <div className={`mt-5 rounded-lg border p-4 ${ok ? 'border-rule bg-brand-tint' : 'border-brand'}`} role="status">
                <p className="font-display text-lg font-bold text-ink">{ok ? 'It works. FUHSD allows school sign-in here.' : 'Signed in, but not a verified FUHSD account.'}</p>
                <p className="mt-1 text-sm text-body">Google says: <strong>{who.email}</strong> · verified: {String(who.email_verified)} · domain: {who.hd || 'none'}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
