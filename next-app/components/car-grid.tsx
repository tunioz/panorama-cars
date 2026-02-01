import { CarCard } from "./CarCard";

type Car = {
  id: string;
  name: string;
  pricePerDay: number;
  image: string;
  specs: string[];
  tag?: string;
  rating?: number;
  reviewsCount?: number;
};

const cars: Car[] = [
  {
    id: "ford-focus-stline-115cv",
    name: "Ford Focus ST Line",
    pricePerDay: 149,
    image:
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=800&q=80",
    specs: ["Hatchback", "Manual", "Diesel", "5 seats"],
    rating: 4.7,
    reviewsCount: 305,
  },
  {
    id: "bmw-x5",
    name: "BMW X5 xDrive40",
    pricePerDay: 289,
    image:
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=800&q=80",
    specs: ["SUV", "Automatic", "Hybrid", "5 seats"],
    rating: 4.9,
    reviewsCount: 189,
  },
  {
    id: "tesla-model-3",
    name: "Tesla Model 3 Long Range",
    pricePerDay: 249,
    image:
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=800&q=80",
    specs: ["Sedan", "Automatic", "Electric", "5 seats"],
    rating: 4.8,
    reviewsCount: 412,
  },
  {
    id: "audi-a4",
    name: "Audi A4 S line",
    pricePerDay: 199,
    image:
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=800&q=80",
    specs: ["Sedan", "Automatic", "Petrol", "5 seats"],
    rating: 4.6,
    reviewsCount: 260,
  },
  {
    id: "kia-sportage",
    name: "Kia Sportage Hybrid",
    pricePerDay: 179,
    image:
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=800&q=80",
    specs: ["SUV", "Automatic", "Hybrid", "5 seats"],
    rating: 4.5,
    reviewsCount: 144,
  },
  {
    id: "mini-cooper",
    name: "Mini Cooper SE",
    pricePerDay: 165,
    image:
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=800&q=80",
    specs: ["Hatchback", "Automatic", "Electric", "4 seats"],
    rating: 4.8,
    reviewsCount: 98,
  },
];

export function CarGrid() {
  return (
    <section className="mx-auto max-w-[1440px] px-6 py-14">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
            Popular picks
          </p>
          <h2 className="text-3xl font-bold text-text-primary">
            Featured vehicles
          </h2>
          <p className="text-text-secondary">
            Curated cars available for instant booking.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-text-secondary">
          <FilterChip label="All" active />
          <FilterChip label="SUV" />
          <FilterChip label="Electric" />
          <FilterChip label="Automatic" />
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cars.map((car) => (
          <CarCard
            key={car.id}
            image={car.image}
            title={car.name}
            pricePerDay={car.pricePerDay}
            rating={car.rating}
            reviewsCount={car.reviewsCount}
            specs={car.specs}
          />
        ))}
      </div>
    </section>
  );
}

function FilterChip({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      className={`rounded-full border px-3 py-1.5 transition-colors ${
        active
          ? "border-primary-200 bg-primary-50 text-primary-700"
          : "border-border text-text-secondary hover:border-primary-200 hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}
