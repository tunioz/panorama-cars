const footerLinks = [
  { title: "Company", items: ["About", "Blog", "Careers", "Press"] },
  {
    title: "Support",
    items: ["Help Center", "Cancellations", "Contact", "Accessibility"],
  },
  { title: "Legal", items: ["Terms", "Privacy", "Cookies", "Licenses"] },
];

const socials = [
  { label: "Twitter", href: "#", icon: "M5 3l14 9-14 9V3z" },
  { label: "Facebook", href: "#", icon: "M7 3h10v18H7z" },
  {
    label: "LinkedIn",
    href: "#",
    icon: "M4 4h4v4H4zM4 10h4v10H4zM10 10h4v2h.1c.6-1.1 2-2.2 4.1-2.2 4.4 0 5.2 2.9 5.2 6.6V20h-4v-3.9c0-.9 0-2-1.2-2-1.2 0-1.4.9-1.4 1.9V20h-4V10z",
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-10 px-6 py-12 md:grid-cols-4">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-lg font-semibold text-primary-600">
              CR
            </div>
            <div>
              <p className="text-base font-semibold text-text-primary">CarRent</p>
              <p className="text-sm text-text-secondary">Premium rentals made simple.</p>
            </div>
          </div>
          <div className="space-y-1 text-sm text-text-secondary">
            <p>+359 888 123 456</p>
            <p>support@carrent.com</p>
            <p>Sofia, Bulgaria</p>
          </div>
          <div className="flex gap-3">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:border-primary-200 hover:text-primary-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d={s.icon} />
                </svg>
              </a>
            ))}
          </div>
        </div>

        {footerLinks.map((group) => (
          <div key={group.title} className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-text-primary">
              {group.title}
            </p>
            <div className="flex flex-col gap-2 text-sm text-text-secondary">
              {group.items.map((item) => (
                <a key={item} href="#" className="transition-colors hover:text-text-primary">
                  {item}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border bg-surface-muted">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-6 py-4 text-sm text-text-secondary md:flex-row md:items-center md:justify-between">
          <p>© 2026 CarRent. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-text-primary">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-text-primary">
              Terms of Service
            </a>
            <a href="#" className="hover:text-text-primary">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
