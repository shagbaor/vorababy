import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { getSettings } from '@/lib/server/settings'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Public: fees to show before checkout, support contacts and FAQs. Admins
// edit these in Firestore meta/settings and meta/content.
export const GET = handle(async () => {
  const [settings, content] = await Promise.all([getSettings(), db().collection('meta').doc('content').get()])
  return ok(
    {
      currency: 'NGN',
      serviceFeeKobo: settings.serviceFeeKobo,
      delivery: {
        baseFeeKobo: settings.deliveryBaseFeeKobo,
        freeKm: settings.deliveryFreeKm,
        perKmKobo: settings.deliveryPerKmKobo,
        maxKm: settings.maxDeliveryKm,
      },
      minTopUpKobo: settings.minTopUpKobo,
      minWithdrawalKobo: settings.minWithdrawalKobo,
      withdrawalFeeKobo: settings.withdrawalFeeKobo,
      supportEmail: settings.supportEmail,
      deliverySlots: [
        { id: 'asap', label: 'ASAP (1-2 hrs)' },
        { id: 'today_12_14', label: 'Today 12–2 PM' },
        { id: 'today_16_18', label: 'Today 4–6 PM' },
        { id: 'tomorrow_morning', label: 'Tomorrow Morning' },
      ],
      faqs: (content.get('faqs') as { question: string; answer: string }[] | undefined) ?? [],
      appLinks: (content.get('appLinks') as Record<string, string> | undefined) ?? {},
    },
    'Config loaded',
  )
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
