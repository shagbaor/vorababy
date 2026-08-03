import Header from '@/components/header'
import Hero from '@/components/hero'
import MobileShowcase from '@/components/mobile-showcase'
import ProductEcosystem from '@/components/product-ecosystem'
import TechStack from '@/components/tech-stack'
import Team from '@/components/team'
import Roadmap from '@/components/roadmap'
import FAQ from '@/components/faq'
import CTASection from '@/components/cta-section'
import Footer from '@/components/footer'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Header />
      <Hero />
      <MobileShowcase />
      <ProductEcosystem />
      <TechStack />
      <Team />
      <Roadmap />
      <FAQ />
      <CTASection />
      <Footer />
    </main>
  )
}
