import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCar, faLocationDot, faEnvelope, faPhone } from "@fortawesome/free-solid-svg-icons";
import { faFacebookF, faTwitter, faInstagram, faLinkedinIn } from "@fortawesome/free-brands-svg-icons";
import { faApple, faGooglePlay } from "@fortawesome/free-brands-svg-icons";

const usefulLinks = ["About us", "Contact us", "Gallery", "Blog", "FAQ"];
const vehicles = ["Sedan", "Cabriolet", "Hatch", "Minivan", "SUV"];

export default function Footer() {
  return (
    <footer id="footer" className="bg-gray-900 text-gray-300 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top contact row */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-gray-800 mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center">
              <FontAwesomeIcon icon={faCar} className="text-brand-400 text-sm" />
            </div>
            <span className="font-semibold text-white text-sm">Car Rental</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center">
              <FontAwesomeIcon icon={faLocationDot} className="text-brand-400 text-sm" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Address</div>
              <div className="text-sm text-white">Oxford Ave, Cary, NC 27519</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center">
              <FontAwesomeIcon icon={faEnvelope} className="text-brand-400 text-sm" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Email</div>
              <div className="text-sm text-white">inquiry@yahoo.com</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center">
              <FontAwesomeIcon icon={faPhone} className="text-brand-400 text-sm" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Phone</div>
              <div className="text-sm text-white">+237 541-6101</div>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
          {/* About */}
          <div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Faucibus faucibus pellentesque dictum turpis. Id pellentesque turpis massa id lavalis lorem Lorem.
            </p>
            <div className="flex items-center gap-3 mt-4">
              {[faFacebookF, faTwitter, faInstagram, faLinkedinIn].map((ic, i) => (
                <a key={i} href="#" className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center hover:bg-brand-500 transition-colors">
                  <FontAwesomeIcon icon={ic} className="text-xs text-gray-400 hover:text-white" />
                </a>
              ))}
            </div>
          </div>

          {/* Useful links */}
          <div>
            <h4 className="font-bold text-white text-sm mb-4">Useful Links</h4>
            <ul className="space-y-2">
              {usefulLinks.map((l) => (
                <li key={l}><a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>

          {/* Vehicles */}
          <div>
            <h4 className="font-bold text-white text-sm mb-4">Vehicles</h4>
            <ul className="space-y-2">
              {vehicles.map((v) => (
                <li key={v}><a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{v}</a></li>
              ))}
            </ul>
          </div>

          {/* Download */}
          <div>
            <h4 className="font-bold text-white text-sm mb-4">Download App</h4>
            <div className="space-y-3">
              <a href="#" className="flex items-center gap-2 bg-gray-800 rounded-lg px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
                <FontAwesomeIcon icon={faApple} className="text-lg" /> App Store
              </a>
              <a href="#" className="flex items-center gap-2 bg-gray-800 rounded-lg px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
                <FontAwesomeIcon icon={faGooglePlay} className="text-lg" /> Google Play
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-500">
          © Duy Anh Car Rental 2024. Designed by Ape Agile.
        </div>
      </div>
    </footer>
  );
}
