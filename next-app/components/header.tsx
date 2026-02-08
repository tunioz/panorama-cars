"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCar, faPhone, faBars, faXmark } from "@fortawesome/free-solid-svg-icons";

const links = [
  { label: "Home", href: "#" },
  { label: "Vehicles", href: "#vehicles" },
  { label: "Details", href: "#about" },
  { label: "About Us", href: "#stats" },
  { label: "Contact Us", href: "#footer" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 font-bold text-lg text-gray-900">
          <FontAwesomeIcon icon={faCar} className="text-brand-500 text-xl" />
          <span>Car Rental</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Phone */}
        <a
          href="tel:+996507600"
          className="hidden md:flex items-center gap-2 text-sm font-semibold text-gray-900"
        >
          <FontAwesomeIcon icon={faPhone} className="text-brand-500" />
          Need Help? +996 507-600
        </a>

        {/* Hamburger */}
        <button
          className="md:hidden p-2 text-gray-700"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          <FontAwesomeIcon icon={open ? faXmark : faBars} className="text-xl" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 pb-4">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-sm font-medium text-gray-700 border-b border-gray-50"
            >
              {l.label}
            </a>
          ))}
          <a
            href="tel:+996507600"
            className="flex items-center gap-2 py-3 text-sm font-semibold text-brand-600"
          >
            <FontAwesomeIcon icon={faPhone} />
            +996 507-600
          </a>
        </div>
      )}
    </header>
  );
}
