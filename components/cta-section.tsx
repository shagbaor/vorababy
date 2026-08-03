'use client'

export default function CTASection() {
  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="bg-emerald-900 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col md:flex-row items-center gap-8 md:gap-0">
          {/* Left Content */}
          <div className="flex-1 px-5 sm:px-8 md:px-12 py-8 sm:py-12 md:py-16">
            <p className="text-emerald-300 text-xs sm:text-sm font-semibold mb-3 sm:mb-4">
              DOWNLOAD THE APP
            </p>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 leading-tight text-balance">
              Your market,
              <br />
              your meals,
              <br />
              <span className="text-amber-400">delivered.</span>
            </h2>
            <p className="text-emerald-100 mb-6 sm:mb-8 text-sm sm:text-base lg:text-lg leading-relaxed max-w-md">
              Farm produce, restaurant food, local vendor goods — all in one app. Download Vorapicks and get everything delivered to your door.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
              <a
                href="#"
                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-white text-emerald-900 px-5 sm:px-6 py-3 sm:py-3 rounded-full font-semibold hover:bg-gray-100 active:bg-gray-200 transition-colors text-sm sm:text-base min-h-[44px] sm:min-h-[48px]"
              >
                Coming Soon
              </a>
              <a
                href="#"
                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-white text-emerald-900 px-5 sm:px-6 py-3 sm:py-3 rounded-full font-semibold hover:bg-gray-100 active:bg-gray-200 transition-colors text-sm sm:text-base min-h-[44px] sm:min-h-[48px]"
              >
                Join Early Investors
              </a>
            </div>
          </div>

          {/* Right - Mobile Mockup */}
          <div className="flex-1 flex justify-center items-center px-4 py-6 sm:py-8 md:py-0 md:pr-4">
            <div className="relative w-36 sm:w-48 md:w-56 rounded-3xl overflow-hidden shadow-2xl">
              <img
                src="/phone-mockup.png"
                alt="Vorapicks App"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
