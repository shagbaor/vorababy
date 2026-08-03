'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    question: 'How do I become a seller on Vorapicks?',
    answer: 'Simply fill out our form, select "Seller" during registration, and follow the guided verification process to list your products.',
  },
  {
    question: 'What areas do you currently serve?',
    answer: 'Vorapicks is active in 3 major cities and expanding rapidly. Check the app for real-time availability in your neighborhood.',
  },
  {
    question: 'How is produce quality ensured?',
    answer: 'We work with certified local vendors and our drivers are trained to handle fresh goods with care to ensure farm-to-table quality.',
  },
  {
    question: "Can I track my delivery?",
    answer: 'Yes, buyers can track their orders in real time from the moment the seller confirms until it reaches your doorstep.',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 sm:mb-3 text-balance">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-600 text-sm sm:text-base">
            Everything you need to know about Vorapicks
          </p>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-3 sm:px-6 py-4 sm:py-5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors gap-3 min-h-[44px]"
              >
                <span className="text-left font-semibold text-gray-900 text-sm sm:text-base line-clamp-2">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-600 flex-shrink-0 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openIndex === index && (
                <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <p className="text-gray-600 leading-relaxed text-sm sm:text-base">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
