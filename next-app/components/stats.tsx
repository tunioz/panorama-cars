import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCar, faUsers, faCalendar, faRoad } from "@fortawesome/free-solid-svg-icons";

const stats = [
  { icon: faCar, value: "540+", label: "Cars" },
  { icon: faUsers, value: "20k+", label: "Customers" },
  { icon: faCalendar, value: "25+", label: "Years" },
  { icon: faRoad, value: "20m+", label: "Miles" },
];

export function Stats() {
  return (
    <section id="stats" className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Facts In Numbers</h2>
        <p className="text-sm text-gray-500 max-w-lg mx-auto mb-12">
          Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Proin gravida auctor condimentum in. Purus gravissimi doctricasti el sir curat familiaris.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl shadow-md p-6 flex items-center gap-4 hover:shadow-lg transition-shadow"
            >
              <div className="w-14 h-14 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                <FontAwesomeIcon icon={s.icon} className="text-brand-500 text-xl" />
              </div>
              <div className="text-left">
                <div className="text-2xl font-extrabold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
