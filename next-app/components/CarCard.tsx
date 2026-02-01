import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

type Props = {
  image: string;
  title: string;
  pricePerDay: number;
  rating?: number;
  reviewsCount?: number;
  specs?: string[];
};

export function CarCard({
  image,
  title,
  pricePerDay,
  rating,
  reviewsCount,
  specs = [],
}: Props) {
  return (
    <Card className="group overflow-hidden rounded-[12px] border border-border shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative">
        <div className="aspect-[16/9] overflow-hidden bg-surface-muted">
          <img
            src={image}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
        {rating !== undefined && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-xs font-semibold text-text-primary shadow-sm">
            <span className="text-amber-500">★</span>
            <span>{rating.toFixed(1)}</span>
            {reviewsCount ? (
              <span className="text-text-muted">({reviewsCount})</span>
            ) : null}
          </div>
        )}
      </div>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
            <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
              {specs.slice(0, 3).map((spec) => (
                <span
                  key={spec}
                  className="rounded-md bg-surface-muted px-2 py-1 font-medium"
                >
                  {spec}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-text-secondary">per day</p>
            <p className="text-xl font-semibold text-text-primary">
              ${pricePerDay}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-primary-600">Free cancellation</div>
          <Button size="sm">Reserve</Button>
        </div>
      </CardContent>
    </Card>
  );
}
