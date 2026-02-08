"use client";

export function CTA() {
  return (
    <section className="bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-4 leading-tight">
          Enjoy every mile with<br />adorable companionship.
        </h2>
        <p className="text-white/70 text-sm max-w-lg mx-auto mb-8">
          Lorem ipsum dolor sit amet. Facilius ipsum erat lectus ultrices sapien elementum ut. Diam tincidunt lorem vel.
        </p>
        <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-white/50"
          />
          <button className="bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg px-6 py-3 text-sm transition-colors">
            Subscribe
          </button>
        </div>
      </div>
    </section>
  );
}
