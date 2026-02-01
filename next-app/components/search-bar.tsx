import { Button } from "./ui/button";
import { Input } from "./ui/input";

// NOTE: Spacing approximates the Figma auto-layout; refine once rate limit lifts.
export function SearchBar() {
  return (
    <section className="mx-auto -mt-14 max-w-[1440px] px-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-lg md:flex-row md:items-end md:gap-6">
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="Pick-up location">
            <Input placeholder="City, airport, or station" />
          </Field>
          <Field label="Drop-off location">
            <Input placeholder="City, airport, or station" />
          </Field>
          <Field label="Pick-up date">
            <Input type="date" />
          </Field>
          <Field label="Drop-off date">
            <Input type="date" />
          </Field>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <Field label="Car type" className="md:w-48">
            <select className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface">
              <option>Any</option>
              <option>Sedan</option>
              <option>SUV</option>
              <option>Hatchback</option>
              <option>EV</option>
            </select>
          </Field>
          <Button size="lg" className="w-full md:w-auto md:min-w-[140px]">
            Search cars
          </Button>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="text-sm font-semibold text-text-secondary">{label}</label>
      {children}
    </div>
  );
}
