'use client'

interface TechCategory {
  category: string
  technologies: string[]
  description: string
}

const techStack: TechCategory[] = [
  {
    category: 'Mobile',
    technologies: ['Flutter', 'React Native'],
    description: 'Cross-platform apps for customer and rider operations',
  },
  {
    category: 'Backend',
    technologies: ['Node.js', 'TypeScript'],
    description: 'Scalable, type-safe core application services and APIs',
  },
  {
    category: 'Database & ORM',
    technologies: ['PostgreSQL', 'Prisma ORM'],
    description: 'Robust transactional data management and schema handling',
  },
  {
    category: 'Real-Time & Caching',
    technologies: ['WebSockets', 'Firebase', 'Redis'],
    description: 'Real-time updates and high-performance data caching',
  },
  {
    category: 'Maps & Payments',
    technologies: ['Mapbox', 'Paystack'],
    description: 'Advanced routing and secure payment processing',
  },
  {
    category: 'Communication',
    technologies: ['WhatsApp Business API', 'Email'],
    description: 'User verification and transactional notifications',
  },
]

export default function TechStack() {
  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-3 sm:mb-4 text-slate-900 text-balance">
          Technology Stack
        </h2>
        <p className="text-center text-slate-600 mb-8 sm:mb-12 max-w-2xl mx-auto text-sm sm:text-base px-2">
          Built on modern, scalable technologies to ensure reliability, performance, and seamless
          user experiences.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {techStack.map((item) => (
            <div
              key={item.category}
              className="bg-gradient-to-br from-emerald-50 to-slate-50 rounded-lg border border-emerald-200 p-4 sm:p-6"
            >
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">{item.category}</h3>
              <p className="text-xs sm:text-sm text-slate-600 mb-3 sm:mb-4">{item.description}</p>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {item.technologies.map((tech) => (
                  <span
                    key={tech}
                    className="text-xs font-semibold bg-white text-emerald-700 px-2.5 sm:px-3 py-1 rounded-full border border-emerald-200 whitespace-nowrap"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
