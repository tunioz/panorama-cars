"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays, faLocationDot, faCarSide } from "@fortawesome/free-solid-svg-icons";

export function Hero() {
  return (
    <section className="relative bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 overflow-hidden">
      {/* Decorative blurred circles */}
      <div className="absolute -left-32 -top-32 w-96 h-96 bg-brand-300/30 rounded-full blur-3xl" />
      <div className="absolute right-0 bottom-0 w-80 h-80 bg-brand-700/20 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
        {/* Left text */}
        <div className="text-white">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-4">
            Experience the road like never before
          </h1>
          <p className="text-white/80 text-base sm:text-lg mb-8 max-w-md">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin gravida auctor justo, quis dignissim ultricies.
          </p>
          <a
            href="#vehicles"
            className="inline-flex items-center gap-2 bg-white text-brand-600 font-semibold rounded-full px-6 py-3 text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            View all cars
          </a>
        </div>

        {/* Booking form */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-md mx-auto md:ml-auto w-full">
          <h2 className="text-lg font-bold text-gray-900 mb-5">Book your car</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Car type</label>
              <div className="relative">
                <select className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white appearance-none focus:ring-2 focus:ring-brand-300 outline-none">
                  <option>Select type</option>
                  <option>Sedan</option>
                  <option>SUV</option>
                  <option>Hatchback</option>
                  <option>Van</option>
                </select>
                <FontAwesomeIcon icon={faCarSide} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Place of rental</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter location"
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-brand-300 outline-none"
                />
                <FontAwesomeIcon icon={faLocationDot} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Place of return</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter location"
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-brand-300 outline-none"
                />
                <FontAwesomeIcon icon={faLocationDot} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Start date</label>
                <div className="relative">
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-brand-300 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Return date</label>
                <div className="relative">
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-brand-300 outline-none"
                  />
                </div>
              </div>
            </div>
            <button className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold rounded-lg py-3.5 text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
              Book now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
