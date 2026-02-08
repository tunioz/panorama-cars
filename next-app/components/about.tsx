import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck } from "@fortawesome/free-solid-svg-icons";

const points = [
  {
    title: "Erat at tempor",
    desc: "Pur potent fermentum ut nam sit sit adipiscing in elementum morbus rutrum. Fusce sed torbet est.",
  },
  {
    title: "Urna nec vivamus risus duis arcu",
    desc: "Adipiscing adipiscing ut semper morbi. Purus non accumsan coniftor habitant at pellentesque. Quib mattis libero et fauciat.",
  },
  {
    title: "Lobortis euismod imperdiet tempus",
    desc: "Turpis consequuat erat cursus feugiat. A augue adipiscing consequat erat egestas. Viverra vitae nisl.",
  },
  {
    title: "Cras nulla aliquet nam eleifend amet at",
    desc: "Adipiscing adipiscing ut semper morbi. Purus non accumsan coniftor habitant at pellentesque. Quisque libero vitae.",
  },
];

export function About() {
  return (
    <section id="about" className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 items-center">
        {/* Image */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-gray-200 to-gray-100 aspect-[4/3] flex items-center justify-center">
          <img
            src="/globe.svg"
            alt="Car"
            className="w-3/4 h-auto object-contain opacity-60"
          />
          {/* Replace with real car image if available */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
        </div>

        {/* Points */}
        <div className="space-y-8">
          {points.map((p, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center mt-0.5">
                <FontAwesomeIcon icon={faCircleCheck} className="text-white text-sm" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 mb-1">{p.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
