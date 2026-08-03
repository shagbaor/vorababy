'use client'

interface Phase {
  phase: string
  title: string
  items: string[]
}

interface Timeline {
  date: string
  milestone: string
}

const phases: Phase[] = [
  {
    phase: 'Phase 1',
    title: 'Foundation',
    items: [
      'Company formation',
      'Product research',
      'Brand development',
      'UI/UX design',
      'Core architecture',
      'Initial engineering team',
    ],
  },
  {
    phase: 'Phase 2',
    title: 'MVP',
    items: [
      'Customer app',
      'Merchant dashboard',
      'Rider infrastructure',
      'Payments integration',
      'Authentication',
      'Admin dashboard',
    ],
  },
  {
    phase: 'Phase 3',
    title: 'Lagos Launch',
    items: [
      'Merchant onboarding',
      'Rider onboarding',
      'Customer acquisition',
      'Delivery operations',
      'Loyalty system',
      'Product optimization',
    ],
  },
  {
    phase: 'Phase 4',
    title: 'Optimization',
    items: [
      'Dispatch improvement',
      'Delivery economics',
      'User retention',
      'Merchant expansion',
      'Recommendation systems',
      'Operational analytics',
    ],
  },
  {
    phase: 'Phase 5',
    title: 'Expansion',
    items: [
      'Abuja launch',
      'Additional Nigerian cities',
      'Agricultural supply expansion',
      'B2B opportunities',
      'Regional expansion',
    ],
  },
]

const timeline: Timeline[] = [
  { date: 'Dec 2025', milestone: 'Vorapicks founded & product architecture established' },
  { date: '2026', milestone: 'Core engineering team assembled & MVP development' },
  { date: '2026', milestone: 'Lagos market launch' },
  { date: '2027', milestone: 'Pre-seed fundraising' },
  { date: '2027+', milestone: 'Geographic & B2B expansion' },
]

export default function Roadmap() {
  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-3 sm:mb-4 text-slate-900 text-balance">
          Product Roadmap
        </h2>
        <p className="text-center text-slate-600 mb-8 sm:mb-12 max-w-2xl mx-auto text-sm sm:text-base px-2">
          Strategic phases guiding Vorapicks from foundation to regional expansion.
        </p>

        {/* Phases */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8 sm:mb-16">
          {phases.map((p) => (
            <div
              key={p.phase}
              className="bg-white rounded-lg border border-emerald-200 p-4 sm:p-5 hover:shadow-md transition"
            >
              <div className="flex items-start gap-2 mb-3">
                <span className="text-base sm:text-lg font-bold text-emerald-700 bg-emerald-50 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0">
                  {p.phase.split(' ')[1]}
                </span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900">{p.title}</h3>
              </div>
              <ul className="space-y-1.5">
                {p.items.map((item) => (
                  <li key={item} className="text-xs text-slate-600 flex items-start gap-2">
                    <span className="text-emerald-600 mt-0.5 flex-shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6 lg:p-8">
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-6">Company Journey</h3>
          <div className="space-y-3 sm:space-y-4">
            {timeline.map((item, index) => (
              <div key={item.date} className="flex gap-4 sm:gap-6 items-start">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-emerald-600 rounded-full mt-1.5 flex-shrink-0"></div>
                  {index < timeline.length - 1 && <div className="w-0.5 h-10 sm:h-12 bg-emerald-200 mt-2"></div>}
                </div>
                <div className="pb-2 sm:pb-4">
                  <p className="font-bold text-emerald-700 text-sm sm:text-base">{item.date}</p>
                  <p className="text-slate-700 text-sm sm:text-base">{item.milestone}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
