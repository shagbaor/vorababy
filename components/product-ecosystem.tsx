'use client'

interface Product {
  title: string
  description: string
  features: string[]
}

const products: Product[] = [
  {
    title: 'Customer App',
    description: 'Seamless ordering experience for users',
    features: [
      'Restaurant discovery',
      'Fresh agricultural products',
      'Order tracking',
      'Digital wallet',
      'Loyalty rewards',
    ],
  },
  {
    title: 'Merchant Platform',
    description: 'Complete dashboard for vendors',
    features: [
      'Product creation & management',
      'Inventory management',
      'Order management',
      'Analytics & insights',
      'Payouts & earnings',
      'Promotions & campaigns',
    ],
  },
  {
    title: 'Rider Platform',
    description: 'Delivery infrastructure & earnings',
    features: [
      'Route navigation',
      'Pickup/delivery confirmation',
      'Earnings tracking',
      'Performance incentives',
    ],
  },
  {
    title: 'Admin Platform',
    description: 'Operational control center',
    features: [
      'User management',
      'Vendor management',
      'Order management',
      'Payment processing',
      'Wallet & escrow management',
      'Delivery zone management',
      'Analytics dashboard',
    ],
  },
]

export default function ProductEcosystem() {
  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-3 sm:mb-4 text-slate-900 text-balance">
          Product Ecosystem
        </h2>
        <p className="text-center text-slate-600 mb-8 sm:mb-12 max-w-2xl mx-auto text-sm sm:text-base px-2">
          Comprehensive platform components designed to connect customers, merchants, riders, and
          operations seamlessly.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {products.map((product) => (
            <div
              key={product.title}
              className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6 hover:shadow-lg transition"
            >
              <h3 className="text-lg sm:text-2xl font-bold text-slate-900 mb-2">{product.title}</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-4">{product.description}</p>
              <ul className="space-y-1.5 sm:space-y-2">
                {product.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm sm:text-base">
                    <span className="text-emerald-600 font-bold mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-slate-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
