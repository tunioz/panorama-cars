 "use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

const testimonials = [
  {
    name: "Maria Petrova",
    title: "Frequent traveler",
    quote:
      "Booking was instant and the car was exactly as shown. The UI feels clean and fast.",
  },
  {
    name: "Ivan Georgiev",
    title: "Business traveler",
    quote:
      "Transparent pricing and great support. I appreciate the quick check-in process.",
  },
  {
    name: "Sofia Dimitrova",
    title: "Weekend getaway",
    quote:
      "Loved the curated fleet. The design matches the Figma reference perfectly.",
  },
];

export function Testimonials() {
  const [index, setIndex] = useState(0);
  const slides = useMemo(() => testimonials, []);
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);
  const next = () => setIndex((i) => (i + 1) % slides.length);

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-14">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
            Testimonials
          </p>
          <h2 className="text-3xl font-bold text-text-primary">
            Travelers love us
          </h2>
          <p className="max-w-2xl text-text-secondary">
            Carousel-style quotes with subtle elevation and rounded corners.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous"
            onClick={prev}
            className="h-10 w-10 rounded-full p-0"
          >
            ‹
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Next"
            onClick={next}
            className="h-10 w-10 rounded-full p-0"
          >
            ›
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {slides.map((item, i) => {
          const isActive = i === index;
          return (
            <Card
              key={item.name}
              className={`rounded-[12px] border border-border bg-surface shadow-sm transition-all duration-200 ${
                isActive ? "shadow-md" : "opacity-80"
              }`}
            >
              <CardContent className="space-y-3 p-6">
                <p className="text-sm leading-relaxed text-text-secondary">
                  “{item.quote}”
                </p>
                <div className="pt-2">
                  <p className="text-base font-semibold text-text-primary">
                    {item.name}
                  </p>
                  <p className="text-sm text-text-muted">{item.title}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              index === i ? "bg-primary-500" : "bg-border"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
