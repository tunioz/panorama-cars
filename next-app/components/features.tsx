import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarCheck, faCouch, faPiggyBank } from "@fortawesome/free-solid-svg-icons";

const items = [
  {
    icon: faCalendarCheck,
    title: "Availability",
    desc: "Ehem tincidunt tincidunt erat at semper fermentum sit divenus gat.",
  },
  {
    icon: faCouch,
    title: "Comfort",
    desc: "Gravida auctor fermentum morbi adipiscing id egerasecorsen't accumsan.",
  },
  {
    icon: faPiggyBank,
    title: "Savings",
    desc: "Proin car centralia sceleris and commodo vehicula tortor lobortis vivpelat.",
  },
];

export function Features() {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-3 gap-10 text-center">
          {items.map((f) => (
            <div key={f.title} className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center">
                <FontAwesomeIcon icon={f.icon} className="text-brand-500 text-2xl" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{f.title}</h3>
              <p className="text-sm text-gray-500 max-w-xs">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
