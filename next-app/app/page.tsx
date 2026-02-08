import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { About } from "@/components/about";
import { CarGrid } from "@/components/car-grid";
import { Stats } from "@/components/stats";
import { MobileApp } from "@/components/mobile-app";
import { CTA } from "@/components/cta";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header />
      <main>
        <Hero />
        <Features />
        <About />
        <CarGrid />
        <Stats />
        <MobileApp />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
