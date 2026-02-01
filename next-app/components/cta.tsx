import { Button } from "./ui/button";

export function CTA() {
  return (
    <section className="bg-primary-500">
      <div className="mx-auto max-w-[1440px] px-6 py-14 text-center text-text-onPrimary">
        <h2 className="text-3xl font-bold md:text-4xl">
          Ready to book your next ride?
        </h2>
        <p className="mt-3 text-base text-primary-50 md:text-lg">
          Explore the fleet, choose your dates, and confirm in minutes.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button size="lg" className="w-full max-w-xs sm:w-auto">
            Book now
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="w-full max-w-xs border border-primary-100 bg-transparent text-text-onPrimary hover:bg-primary-400 sm:w-auto"
          >
            Contact sales
          </Button>
        </div>
      </div>
    </section>
  );
}
