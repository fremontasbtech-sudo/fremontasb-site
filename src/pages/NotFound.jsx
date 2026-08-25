import PageHero from '../components/PageHero'
import Button from '../components/Button'

export default function NotFound() {
  return (
    <PageHero title="Page not found" subtext="That link doesn't go anywhere. It may have moved when we rebuilt the site.">
      <Button to="/" text="Back to Home" />
    </PageHero>
  )
}
