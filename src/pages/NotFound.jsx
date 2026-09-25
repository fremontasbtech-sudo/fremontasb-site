import PageHero from '../components/PageHero'
import Button from '../components/Button'

export default function NotFound() {
  return (
    <PageHero title="Page not found" subtext="We couldn’t find this page. It may have been moved when the website was updated.">
      <Button to="/" text="Back to Home" />
    </PageHero>
  )
}
