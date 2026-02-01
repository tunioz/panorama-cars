'use client';

import { useState } from 'react';

const navLinks = [
  { label: 'Home', href: '#' },
  { label: 'Vehicles', href: '#vehicles' },
  { label: 'Services', href: '#services' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '#contact' },
];

function IconCar() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-7 w-7"
    >
      <path d="M5.5 11 7 7h10l1.5 4H5.5ZM5 13h14v4a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H11a2 2 0 0 1-4 0H6a1 1 0 0 1-1-1v-4Zm2.5 1.5a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Zm9 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Z" />
    </svg>
  );
}

function IconAdmin() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-3.3 3-6 7-6s7 2.7 7 6" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 6l12 12M6 18 18 6" />
    </svg>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-lg font-semibold text-primary-600">
            <IconCar />
          </div>
          <span className="text-lg font-semibold text-text-primary">
            Car Rental
          </span>
        </div>

        <nav className="hidden items-center gap-8 text-base font-medium text-text-secondary lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-text-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <span className="text-base font-semibold text-text-primary">
            Коли под наем
          </span>
          <div className="flex items-center gap-2 rounded-md bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700">
            <IconAdmin />
            <span>Админ</span>
          </div>
        </div>

        <div className="flex items-center gap-3 lg:hidden">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:border-primary-200 hover:text-text-primary"
            aria-label="Open menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-white lg:hidden">
          <nav className="mx-auto flex max-w-[1440px] flex-col gap-1 px-6 py-3 text-base font-medium text-text-secondary">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 transition-colors hover:bg-surface-muted hover:text-text-primary"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-6 pb-4">
            <span className="text-base font-semibold text-text-primary">
              Коли под наем
            </span>
            <div className="flex items-center gap-2 rounded-md bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700">
              <IconAdmin />
              <span>Админ</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
