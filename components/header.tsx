'use client'

import Image from 'next/image'
import { useState } from 'react'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { label: 'How It Works', href: '#' },
    { label: 'Buyers', href: '#' },
    { label: 'Sellers', href: '#' },
    { label: 'Restaurants', href: '#' },
    { label: 'Drivers', href: '#' },
  ]

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0 min-h-[44px] sm:min-h-auto">
            <Image
              src="/vorapicks-logo.png"
              alt="Vorapicks"
              width={40}
              height={40}
              className="w-8 h-8 sm:w-10 sm:h-10"
            />
            <span className="text-base sm:text-xl font-semibold text-gray-900 truncate">vorapicks</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors"
              >
                {item.label}
              </a>
            ))}
            <button className="bg-emerald-900 text-white px-5 sm:px-6 py-2 rounded-full text-sm font-medium hover:bg-emerald-800 transition-colors">
              Download App
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
              />
            </svg>
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden mt-4 pb-4 space-y-3 border-t border-gray-100 pt-4">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="block px-3 py-2.5 text-gray-700 hover:bg-gray-50 rounded-lg font-medium text-sm transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <button className="w-full bg-emerald-900 text-white px-4 py-2.5 rounded-full font-medium hover:bg-emerald-800 transition-colors text-sm">
              Download App
            </button>
          </nav>
        )}
      </div>
    </header>
  )
}
