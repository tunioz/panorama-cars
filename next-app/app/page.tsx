import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { SearchBar } from "@/components/search-bar";
import { CarGrid } from "@/components/car-grid";
import { Features } from "@/components/features";
import { Testimonials } from "@/components/testimonials";
import { CTA } from "@/components/cta";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <Header />
      <main>
        <Hero />
        <SearchBar />
        <CarGrid />
        <Features />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
