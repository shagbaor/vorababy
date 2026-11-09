import 'server-only'
import { randomUUID } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getApps } from 'firebase-admin/app'
import { ApiError } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

// Uploads go straight from the app to Firebase Storage through a short-lived
// signed URL. files/{fileId} records who uploaded what; endpoints that use a
// file check it belongs to the caller and was really uploaded.

export type UploadPurpose = 'product_photo' | 'store_logo' | 'store_cover' | 'kyc_document' | 'avatar' | 'chat_attachment' | 'delivery_proof'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const RULES: Record<UploadPurpose, { types: string[]; maxBytes: number; public: boolean }> = {
  product_photo: { types: IMAGE_TYPES, maxBytes: 5_000_000, public: true },
  store_logo: { types: IMAGE_TYPES, maxBytes: 5_000_000, public: true },
  store_cover: { types: IMAGE_TYPES, maxBytes: 5_000_000, public: true },
  avatar: { types: IMAGE_TYPES, maxBytes: 5_000_000, public: true },
  chat_attachment: { types: [...IMAGE_TYPES, 'application/pdf'], maxBytes: 10_000_000, public: false },
  delivery_proof: { types: IMAGE_TYPES, maxBytes: 5_000_000, public: false },
  kyc_document: { types: [...IMAGE_TYPES, 'application/pdf'], maxBytes: 10_000_000, public: false },
}

export const UPLOAD_PURPOSES = Object.keys(RULES) as UploadPurpose[]

function bucket() {
  db() // initialises the app
  const name = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`
  return getStorage(getApps()[0]).bucket(name)
}

export async function createUpload(uid: string, purpose: UploadPurpose, contentType: string, sizeBytes: number) {
  const rule = RULES[purpose]
  if (!rule.types.includes(contentType)) {
    throw new ApiError('validation_failed', 'This file type is not allowed', { contentType: `Use ${rule.types.join(', ')}` })
  }
  if (sizeBytes > rule.maxBytes) {
    throw new ApiError('validation_failed', 'This file is too large', { sizeBytes: `Maximum ${rule.maxBytes / 1_000_000} MB` })
  }
  const ref = db().collection('files').doc()
  const path = `${purpose}/${uid}/${ref.id}`
  const expires = Date.now() + 15 * 60 * 1000
  const [uploadUrl] = await bucket().file(path).getSignedUrl({ version: 'v4', action: 'write', expires, contentType })
  await ref.set({ ownerId: uid, purpose, path, contentType, sizeBytes, createdAt: FieldValue.serverTimestamp() })
  return { fileId: ref.id, uploadUrl, expiresAt: new Date(expires).toISOString() }
}

// Checks the file belongs to `uid`, has the expected purpose and was uploaded.
// Public files get a permanent download URL; private ones return url null.
export async function useFile(uid: string, fileId: string, purposes: UploadPurpose[]) {
  const snapshot = await db().collection('files').doc(String(fileId)).get()
  if (!snapshot.exists || snapshot.get('ownerId') !== uid || !purposes.includes(snapshot.get('purpose'))) {
    throw new ApiError('validation_failed', 'Upload not found', { fileId: 'Upload the file first' })
  }
  const file = bucket().file(snapshot.get('path'))
  const [exists] = await file.exists()
  if (!exists) throw new ApiError('validation_failed', 'The upload did not finish', { fileId: 'Upload the file again' })

  let url: string | null = snapshot.get('url') ?? null
  if (!url && RULES[snapshot.get('purpose') as UploadPurpose].public) {
    const token = randomUUID()
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } })
    url = `https://firebasestorage.googleapis.com/v0/b/${file.bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`
    await snapshot.ref.update({ url })
  }
  return { fileId: snapshot.id, url }
}

// Short-lived link for private files (KYC documents) shown to admins.
export async function privateFileUrl(fileId: string) {
  const snapshot = await db().collection('files').doc(fileId).get()
  if (!snapshot.exists) return null
  const [url] = await bucket().file(snapshot.get('path')).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 30 * 60 * 1000 })
  return url
}
