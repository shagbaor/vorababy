import { FieldValue } from 'firebase-admin/firestore'
import { requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { presentReview } from '@/lib/server/reviews'

export const dynamic = 'force-dynamic'

// "Helpful" on a review: toggles the caller's mark and returns the review.
export const POST = handle<{ params: Promise<{ id: string; reviewId: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request)
  const { id, reviewId } = await params
  const ref = db().collection('stores').doc(id).collection('reviews').doc(reviewId)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new ApiError('not_found', 'Review not found')
  if (snapshot.get('buyerId') === user.uid) throw new ApiError('conflict', 'You cannot mark your own review as helpful')
  const marked = ((snapshot.get('helpfulBy') as string[] | undefined) ?? []).includes(user.uid)
  await ref.update({ helpfulBy: marked ? FieldValue.arrayRemove(user.uid) : FieldValue.arrayUnion(user.uid) })
  return ok(presentReview(await ref.get(), user.uid), marked ? 'Removed' : 'Marked as helpful')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
