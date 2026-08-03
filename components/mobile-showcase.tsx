'use client'

import Image from 'next/image'

export default function MobileShowcase() {
  return (
    <section className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Mobile: Single Phone, Desktop: Three Phones */}
        <div className="hidden sm:flex relative h-64 sm:h-96 lg:h-[500px] items-end justify-center gap-3 sm:gap-8">
          {/* Left Phone - Smaller */}
          <div className="relative w-24 sm:w-32 lg:w-40 -rotate-12 transform rounded-3xl overflow-hidden shadow-2xl">
            <img
              src="/phone-mockup.png"
              alt="Vorapicks App"
              className="w-full h-auto"
            />
          </div>

          {/* Center Phone - Largest */}
          <div className="relative w-32 sm:w-40 lg:w-48 z-10 rounded-3xl overflow-hidden shadow-2xl">
            <img
              src="/phone-mockup.png"
              alt="Vorapicks App"
              className="w-full h-auto"
            />
          </div>

          {/* Right Phone - Smaller */}
          <div className="relative w-24 sm:w-32 lg:w-40 rotate-12 transform rounded-3xl overflow-hidden shadow-2xl">
            <img
              src="/phone-mockup.png"
              alt="Vorapicks App"
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Mobile: Single centered phone */}
        <div className="sm:hidden flex justify-center">
          <div className="relative w-40 rounded-3xl overflow-hidden shadow-2xl">
            <img
              src="/phone-mockup.png"
              alt="Vorapicks App"
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
