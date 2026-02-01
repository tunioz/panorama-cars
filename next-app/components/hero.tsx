import { Button } from "./ui/button";

// NOTE: Exact pixel values approximated from available tokens due to Figma API rate limit.
// Adjust once rate limit clears to match Inspect values precisely.
export function Hero() {
  return (
    <section className="bg-background">
      <div className="relative mx-auto max-w-[1440px] px-6 pb-16 pt-14 md:pb-20 md:pt-18">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5 md:space-y-6">
            <span className="inline-flex h-9 items-center rounded-full bg-primary-50 px-4 text-xs font-semibold uppercase tracking-wide text-primary-600">
              Premium Car Rental
            </span>
            <h1 className="text-4xl font-bold leading-tight text-text-primary md:text-[44px] md:leading-[1.15]">
              Find the perfect car for your next journey
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
              Curated vehicles, transparent pricing, and instant confirmation.
              Designed to mirror the Figma hero with balanced spacing and
              elevation cues.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" className="min-w-[150px]">
                Start booking
              </Button>
              <Button variant="ghost" size="lg" className="min-w-[140px]">
                View fleet
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm text-text-secondary md:max-w-md">
              {[
                { label: "Available cars", value: "120+" },
                { label: "Customer rating", value: "4.9/5" },
                { label: "Support", value: "24/7" },
              ].map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <p className="text-xl font-semibold text-text-primary">
                    {stat.value}
                  </p>
                  <p>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative h-[360px] w-full md:h-[420px]">
            <div className="absolute inset-0 rounded-2xl bg-primary-50 blur-3xl" />
            <div className="relative h-full overflow-hidden rounded-[18px] shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-tr from-[rgba(11,18,32,0.45)] via-[rgba(11,18,32,0.25)] to-transparent" />
              <img
                src="https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1400&q=80"
                alt="Hero car"
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[rgba(11,18,32,0.55)] to-transparent px-5 pb-5 pt-16 text-white">
                <p className="text-sm font-medium text-primary-50">Featured</p>
                <p className="text-lg font-semibold">BMW X5 xDrive40</p>
                <p className="text-sm text-primary-50">Automatic · Hybrid · 5 seats</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
