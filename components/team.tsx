'use client'

interface TeamMember {
  name: string
  role: string
  background: string
  focus: string[]
}

const teamMembers: TeamMember[] = [
  {
    name: 'Israel-John',
    role: 'Founder & CEO',
    background: 'B.Sc. Accounting (Univ. of Uyo), M.Sc. AI & Tech Management (Nexford Univ.)',
    focus: [
      'Company Vision',
      'Business Strategy',
      'Financial Strategy',
      'Fundraising',
      'Investor Relations',
      'Product Direction',
      'Go-to-Market',
      'Partnerships',
    ],
  },
  {
    name: 'Solomon Nongov',
    role: 'Co-Founder & CTO',
    background: 'Technical Leadership & System Architecture',
    focus: [
      'Tech Strategy',
      'Backend Architecture',
      'System Architecture',
      'Infrastructure',
      'Database Architecture',
      'APIs',
      'Security',
      'Scalability',
    ],
  },
  {
    name: 'Laura Salami',
    role: 'Head of Engineering',
    background: 'Engineering Execution & Team Leadership',
    focus: [
      'Engineering Execution',
      'Team Coordination',
      'Code Quality',
      'Technical Implementation',
      'Feature Delivery',
      'Testing/QA',
      'Technical Documentation',
    ],
  },
  {
    name: 'Ademujimi Ayomide Samuel',
    role: 'Mobile App Developer',
    background: 'Mobile Development & Customer Experience',
    focus: [
      'Mobile App Development',
      'Customer App Implementation',
      'UI Design',
      'API Integration',
      'Payment Integration',
      'Order Management',
      'Location Features',
    ],
  },
]

export default function Team() {
  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-3 sm:mb-4 text-slate-900 text-balance">
          Leadership & Team
        </h2>
        <p className="text-center text-slate-600 mb-8 sm:mb-12 max-w-2xl mx-auto text-sm sm:text-base px-2">
          Meet the talented team driving Vorapicks forward with diverse expertise in technology,
          business, and operations.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {teamMembers.map((member) => (
            <div key={member.name} className="p-4 sm:p-6 border border-slate-200 rounded-lg hover:shadow-lg transition bg-white">
              <div className="flex items-start gap-3 sm:gap-4 mb-4">
                <div className="w-14 sm:w-16 h-14 sm:h-16 bg-gradient-to-br from-emerald-200 to-emerald-400 rounded-full flex-shrink-0 flex items-center justify-center">
                  <div className="text-xl sm:text-2xl font-bold text-emerald-700">{member.name.charAt(0)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">{member.name}</h3>
                  <p className="text-sm sm:text-base text-emerald-700 font-semibold line-clamp-1">{member.role}</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mb-4 line-clamp-3">{member.background}</p>
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">FOCUS AREAS</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {member.focus.map((item) => (
                    <span
                      key={item}
                      className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded whitespace-nowrap"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
