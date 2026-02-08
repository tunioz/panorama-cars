"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGear,
  faGasPump,
  faSnowflake,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";

interface CarData {
  name: string;
  type: string;
  price: number;
  transmission: string;
  fuel: string;
  ac: boolean;
  image: string | null;
}

const cars: CarData[] = [
  { name: "Mercedes", type: "Sedan", price: 25, transmission: "Automatic", fuel: "Petrol", ac: true, image: null },
  { name: "Mercedes", type: "Sport", price: 50, transmission: "Automatic", fuel: "Petrol", ac: true, image: null },
  { name: "Mercedes", type: "SUV", price: 45, transmission: "Automatic", fuel: "Diesel", ac: true, image: null },
  { name: "Porsche", type: "SUV", price: 10, transmission: "Automatic", fuel: "Electric", ac: true, image: null },
  { name: "Toyota", type: "SUV", price: 35, transmission: "Automatic", fuel: "Hybrid", ac: true, image: null },
  { name: "Porsche", type: "SUV", price: 50, transmission: "Automatic", fuel: "Petrol", ac: true, image: null },
];

function CarSilhouette() {
  return (
    <svg viewBox="0 0 400 200" className="w-4/5 h-auto opacity-30">
      <path
        d="M50 140 Q60 100 120 90 L160 70 Q200 55 260 70 L310 90 Q360 100 370 140 Z"
        fill="#9CA3AF"
      />
      <circle cx="120" cy="150" r="22" fill="#6B7280" />
      <circle cx="120" cy="150" r="12" fill="#D1D5DB" />
      <circle cx="310" cy="150" r="22" fill="#6B7280" />
      <circle cx="310" cy="150" r="12" fill="#D1D5DB" />
      <rect x="40" y="140" width="340" height="6" rx="3" fill="#9CA3AF" />
    </svg>
  );
}

function CarCard({ car }: { car: CarData }) {
  return (
    <div className="bg-white rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-2 transition-all duration-300 overflow-hidden group">
      {/* Image */}
      <div className="h-48 bg-gradient-to-b from-gray-100 to-gray-200 flex items-center justify-center p-6">
        {car.image ? (
          <img src={car.image} alt={car.name} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <CarSilhouette />
        )}
      </div>

      <div className="p-5">
        {/* Header: name + price */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{car.name}</h3>
            <p className="text-sm text-gray-400">{car.type}</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-extrabold text-brand-500">${car.price}</span>
            <p className="text-xs text-gray-400">per day</p>
          </div>
        </div>

        {/* Specs */}
        <div className="flex items-center justify-between border-t border-b border-gray-100 py-3 my-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <FontAwesomeIcon icon={faGear} className="text-sm" />
            <span>{car.transmission}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <FontAwesomeIcon icon={faGasPump} className="text-sm" />
            <span>{car.fuel}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <FontAwesomeIcon icon={faSnowflake} className="text-sm" />
            <span>Air Conditioner</span>
          </div>
        </div>

        {/* Button */}
        <button className="w-full bg-gradient-to-r from-brand-500 to-brand-400 text-white font-bold rounded-xl py-3 text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
          View Details
          <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
        </button>
      </div>
    </div>
  );
}

export function CarGrid() {
  return (
    <section id="vehicles" className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Choose the car that<br />suits you
          </h2>
          <a href="#" className="hidden sm:flex items-center gap-1 text-sm font-semibold text-brand-500 hover:underline">
            View All <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
          </a>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cars.map((c, i) => (
            <CarCard key={i} car={c} />
          ))}
        </div>
      </div>
    </section>
  );
}
