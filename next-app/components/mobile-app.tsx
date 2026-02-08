import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faApple, faGooglePlay } from "@fortawesome/free-brands-svg-icons";

export function MobileApp() {
  return (
    <section className="py-16 md:py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 items-center">
        {/* Text */}
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
            Download<br />mobile app
          </h2>
          <p className="text-sm text-gray-500 mb-8 max-w-md leading-relaxed">
            Imperdiet ut tristique aliquem auctor. Ultrices una uti auctor cursus pulvinar. Sapien volutpat blandit. Elit fermentum senectus sit vita aliquam. Auctor quia facilisi elit consectetur purus. Risqua curet natoque porttitor.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="inline-flex items-center gap-2 bg-gray-900 text-white rounded-lg px-5 py-3 text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              <FontAwesomeIcon icon={faApple} className="text-lg" />
              App Store
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 bg-gray-900 text-white rounded-lg px-5 py-3 text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              <FontAwesomeIcon icon={faGooglePlay} className="text-lg" />
              Google Play
            </a>
          </div>
        </div>

        {/* Phone mockups */}
        <div className="flex justify-center md:justify-end items-end gap-4">
          <div className="w-40 sm:w-48 h-72 sm:h-80 bg-gray-100 rounded-3xl border-4 border-gray-200 shadow-lg flex items-center justify-center">
            <svg viewBox="0 0 200 120" className="w-24 opacity-25">
              <path d="M30 80 Q40 50 80 45 L110 30 Q140 20 170 35 L190 50 Q200 60 200 80 Z" fill="#6B7280" />
              <circle cx="70" cy="88" r="12" fill="#9CA3AF" />
              <circle cx="170" cy="88" r="12" fill="#9CA3AF" />
            </svg>
          </div>
          <div className="w-44 sm:w-52 h-80 sm:h-96 bg-gray-100 rounded-3xl border-4 border-gray-200 shadow-xl flex items-center justify-center -mb-4">
            <svg viewBox="0 0 200 120" className="w-28 opacity-25">
              <path d="M30 80 Q40 50 80 45 L110 30 Q140 20 170 35 L190 50 Q200 60 200 80 Z" fill="#6B7280" />
              <circle cx="70" cy="88" r="12" fill="#9CA3AF" />
              <circle cx="170" cy="88" r="12" fill="#9CA3AF" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
