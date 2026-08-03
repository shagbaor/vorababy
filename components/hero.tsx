'use client'

export default function Hero() {
  return (
    <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight text-balance">
          One app for everything you need.
        </h1>

        {/* Description */}
        <p className="text-base sm:text-lg text-gray-600 mb-8 sm:mb-12 max-w-2xl mx-auto leading-relaxed px-2">
          Vorapicks is your multi-source marketplace order fresh farm produce, restaurant meals, and goods from local vendors, all delivered fast by our driver network.
        </p>

        {/* Download Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 w-full sm:w-auto px-2 sm:px-0">
          <a
            href="#"
            className="w-full sm:w-auto flex items-center justify-center gap-3 bg-black text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-medium hover:bg-gray-900 active:bg-gray-800 transition-colors text-sm sm:text-base min-h-[44px] sm:min-h-[48px]"
          >
            Coming Soon
          </a>
          <a
            href="#"
            className="w-full sm:w-auto flex items-center justify-center gap-3 bg-black text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-medium hover:bg-gray-900 active:bg-gray-800 transition-colors text-sm sm:text-base min-h-[44px] sm:min-h-[48px]"
          >
            Join Early Investors
          </a>
        </div>
      </div>
    </section>
  )
}
