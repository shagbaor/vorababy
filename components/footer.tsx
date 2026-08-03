'use client'

import { Leaf } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-emerald-950 text-white py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-emerald-800">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="bg-emerald-700 rounded-lg p-2">
              <Leaf className="w-5 h-5 text-white" strokeWidth={3} />
            </div>
            <span className="text-base sm:text-lg font-semibold">vorapicks</span>
          </div>

          {/* Links */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 text-sm sm:text-base">
            <a href="#" className="text-emerald-200 hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#" className="text-emerald-200 hover:text-white transition-colors">
              Buyers
            </a>
            <a href="#" className="text-emerald-200 hover:text-white transition-colors">
              Sellers
            </a>
            <a href="#" className="text-emerald-200 hover:text-white transition-colors">
              Restaurants
            </a>
            <a href="#" className="text-emerald-200 hover:text-white transition-colors">
              Drivers
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-6 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-emerald-300 text-xs sm:text-sm">
            © 2026 Vorapicks. All rights reserved
          </p>

          <div className="flex items-center gap-3 sm:gap-4">
            <a
              href="#"
              className="text-emerald-200 hover:text-white transition-colors"
              aria-label="Twitter"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7a4.5 4.5 0 01-1.3-.2" />
              </svg>
            </a>
            <a
              href="#"
              className="text-emerald-200 hover:text-white transition-colors"
              aria-label="Facebook"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 2h-3a6 6 0 00-6 6v3H7v4h2v8h4v-8h3l1-4h-4V8a2 2 0 012-2h3z" />
              </svg>
            </a>
            <a
              href="#"
              className="text-emerald-200 hover:text-white transition-colors"
              aria-label="Instagram"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" fill="white" />
                <circle cx="17.5" cy="6.5" r="1.5" fill="white" />
              </svg>
            </a>
            <a
              href="#"
              className="text-emerald-200 hover:text-white transition-colors"
              aria-label="YouTube"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23 4.3a3 3 0 00-2.1-2.1C18.9 2 12 2 12 2s-6.9 0-8.9.2a3 3 0 00-2.1 2.1C1 6.3 1 12 1 12s0 5.7.2 7.7a3 3 0 002.1 2.1c2 .2 8.9.2 8.9.2s6.9 0 8.9-.2a3 3 0 002.1-2.1C23 17.7 23 12 23 12s0-5.7-.2-7.7z" />
                <path d="M9.5 15.5l5.5-3.5-5.5-3.5z" fill="white" />
              </svg>
            </a>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 text-emerald-300 text-xs sm:text-sm">
            <a href="#" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
