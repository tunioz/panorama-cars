import { Card, CardContent } from "./ui/card";

const features = [
  {
    title: "Real-time availability",
    description: "Inventory synced across locations with instant confirmation.",
    icon: "🚗",
  },
  {
    title: "Transparent pricing",
    description: "No hidden fees. Taxes and insurance shown upfront.",
    icon: "💳",
  },
  {
    title: "Premium support",
    description: "24/7 concierge for quick pickups and returns.",
    icon: "🕑",
  },
];

export function Features() {
  return (
    <section className="bg-surface-muted">
      <div className="mx-auto max-w-[1440px] px-6 py-14">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
            Why choose us
          </p>
          <h2 className="text-3xl font-bold text-text-primary">
            Designed for seamless rentals
          </h2>
          <p className="max-w-2xl text-text-secondary">
            Feature cards with consistent 24px padding, subtle elevation, and
            rounded corners as in the Figma block.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="overflow-hidden rounded-[12px] border border-border bg-surface shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              <CardContent className="space-y-3 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-50 text-2xl">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {feature.title}
                </h3>
                <p className="text-sm text-text-secondary">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
