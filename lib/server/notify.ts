import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { getApps } from 'firebase-admin/app'
import { db } from '@/lib/firebase/admin'

// In-app notification (users/{uid}/notifications) plus a push to every device
// the person registered (users/{uid}/devices). Push failures never fail the
// request that caused them.

export type NotificationType =
  | 'order_status'
  | 'new_order'
  | 'job_offer'
  | 'message'
  | 'split_invite'
  | 'split_update'
  | 'shopping_request'
  | 'shopping_suggestions'
  | 'payment'
  | 'verification'
  | 'payout'

export async function notify(uid: string, type: NotificationType, title: string, body: string, data: Record<string, string> = {}) {
  try {
    const user = db().collection('users').doc(uid)
    await user.collection('notifications').add({ type, title, body, data, read: false, createdAt: FieldValue.serverTimestamp() })

    const devices = await user.collection('devices').get()
    if (devices.empty) return
    db() // ensure the app is initialised before messaging
    const response = await getMessaging(getApps()[0]).sendEachForMulticast({
      tokens: devices.docs.map((d) => d.get('token') as string),
      notification: { title, body },
      data: { type, ...data },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    })
    // Forget tokens Firebase says are dead.
    await Promise.all(
      response.responses.map((r, i) =>
        !r.success && /registration-token-not-registered|invalid-argument|invalid-registration-token/.test(r.error?.code ?? '')
          ? devices.docs[i].ref.delete()
          : null,
      ),
    )
  } catch (error) {
    console.error(`notify ${type} to ${uid} failed`, error)
  }
}

export async function notifyMany(uids: string[], ...args: Parameters<typeof notify> extends [string, ...infer R] ? R : never) {
  await Promise.all(uids.map((uid) => notify(uid, ...args)))
}
