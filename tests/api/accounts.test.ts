import { beforeEach, describe, expect, it } from 'vitest'
import { GET as me } from '@/app/api/v1/me/route'
import { POST as signup } from '@/app/api/v1/signup/route'
import { POST as createStore } from '@/app/api/v1/stores/route'
import { POST as createRider } from '@/app/api/v1/riders/route'
import { applyAdminAction, inviteAdmin, inviteInput } from '@/lib/server/accounts'
import { adminAuth, adminDb, call, idTokenFor, phoneUser, resetEmulators } from './helpers'

const admin = { uid: 'admin-1', email: 'ops@vorapicks.com' }
const store = {
  name: 'Green Valley Farm',
  type: 'farm',
  description: 'Fresh vegetables from Epe',
  address: { line: '4 Farm Road', area: 'Epe', city: 'Lagos', state: 'Lagos' },
  location: { lat: 6.5841, lng: 3.9834 },
}

beforeEach(async () => {
  await resetEmulators()
})

describe('sign-up', () => {
  it('rejects requests without a valid token', async () => {
    expect((await call(me, { method: 'GET' })).status).toBe(401)
    expect((await call(me, { method: 'GET', token: 'not-a-token' })).status).toBe(401)
  })

  it('returns no profile before sign-up is finished', async () => {
    const { token } = await phoneUser('+2348000000001')
    const res = await call(me, { method: 'GET', token })
    expect(res.status).toBe(200)
    expect(res.body.data.user).toBeNull()
  })

  it('creates a buyer with their verified phone number and sets the role', async () => {
    const { uid, token } = await phoneUser('+2348000000001')
    const res = await call(signup, { token, body: { role: 'buyer', fullName: 'Amaka Osei', email: 'Amaka@Email.com' } })
    expect(res.status).toBe(201)
    expect(res.body.data.user).toMatchObject({
      id: uid,
      role: 'buyer',
      fullName: 'Amaka Osei',
      email: 'amaka@email.com',
      phone: '+2348000000001',
      status: 'active',
      verificationStatus: 'not_required',
    })
    expect((await adminAuth().getUser(uid)).customClaims).toEqual({ role: 'buyer' })
  })

  it("won't let someone sign up twice or as an admin", async () => {
    const { token } = await phoneUser('+2348000000001')
    await call(signup, { token, body: { role: 'buyer', fullName: 'Amaka Osei' } })
    const again = await call(signup, { token, body: { role: 'seller', fullName: 'Amaka Osei' } })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('already_registered')

    const other = await phoneUser('+2348000000009')
    const asAdmin = await call(signup, { token: other.token, body: { role: 'admin', fullName: 'Sneaky' } })
    expect(asAdmin.status).toBe(400)
    expect(asAdmin.body.error.fields.role).toBeDefined()
  })

  it('explains which fields are wrong', async () => {
    const { token } = await phoneUser('+2348000000001')
    const res = await call(signup, { token, body: { role: 'buyer', fullName: 'A', email: 'nope' } })
    expect(res.status).toBe(400)
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['email', 'fullName'])
  })
})

describe('sellers', () => {
  it('registers a pending store and blocks a second one', async () => {
    const { uid } = await phoneUser('+2348000000002')
    let token = await idTokenFor(uid)
    await call(signup, { token, body: { role: 'seller', fullName: 'Chidi Okafor' } })
    token = await idTokenFor(uid) // refresh to pick up the seller role

    const res = await call(createStore, { token, body: store })
    expect(res.status).toBe(201)
    expect(res.body.data.user.verificationStatus).toBe('pending')
    expect(res.body.data.store).toMatchObject({ ownerId: uid, name: 'Green Valley Farm', verificationStatus: 'pending', isOpen: false, location: { lat: 6.5841, lng: 3.9834 } })

    const second = await call(createStore, { token, body: store })
    expect(second.status).toBe(409)
  })

  it('stops buyers and stale tokens from registering a store', async () => {
    const { uid } = await phoneUser('+2348000000001')
    const tokenBeforeRole = await idTokenFor(uid)
    await call(signup, { token: tokenBeforeRole, body: { role: 'buyer', fullName: 'Amaka Osei' } })
    expect((await call(createStore, { token: tokenBeforeRole, body: store })).status).toBe(403)
    expect((await call(createStore, { token: await idTokenFor(uid), body: store })).status).toBe(403)
  })
})

describe('riders', () => {
  it('registers a rider and requires a plate number for motor vehicles', async () => {
    const { uid } = await phoneUser('+2348000000003')
    await call(signup, { token: await idTokenFor(uid), body: { role: 'rider', fullName: 'Emeka Johnson' } })
    const token = await idTokenFor(uid)

    const missingPlate = await call(createRider, { token, body: { vehicleType: 'motorbike' } })
    expect(missingPlate.status).toBe(400)
    expect(missingPlate.body.error.fields.plateNumber).toBeDefined()

    const res = await call(createRider, { token, body: { vehicleType: 'motorbike', plateNumber: 'lnd-123-xy' } })
    expect(res.status).toBe(201)
    expect(res.body.data.rider).toMatchObject({ vehicleType: 'motorbike', plateNumber: 'LND-123-XY', verificationStatus: 'pending', isOnline: false })
  })
})

describe('admin actions', () => {
  async function seller() {
    const { uid } = await phoneUser('+2348000000002')
    await call(signup, { token: await idTokenFor(uid), body: { role: 'seller', fullName: 'Chidi Okafor' } })
    return uid
  }

  it("won't verify a seller who hasn't registered a store", async () => {
    const uid = await seller()
    await expect(applyAdminAction(admin, uid, 'verify')).rejects.toMatchObject({ code: 'registration_incomplete' })
  })

  it('verifying a seller approves their store and logs the action', async () => {
    const uid = await seller()
    await call(createStore, { token: await idTokenFor(uid), body: store })
    const result = await applyAdminAction(admin, uid, 'verify')
    expect(result.user).toMatchObject({ verified: true, verificationStatus: 'approved' })
    expect(result.store).toMatchObject({ verificationStatus: 'approved' })

    const log = await adminDb().collection('auditLog').where('targetId', '==', uid).get()
    expect(log.docs.map((d) => d.data().action)).toEqual(['verify'])
  })

  it('suspending signs the person out and blocks the API until lifted', async () => {
    const { uid, token } = await phoneUser('+2348000000001')
    await call(signup, { token, body: { role: 'buyer', fullName: 'Amaka Osei' } })

    await applyAdminAction(admin, uid, 'suspend')
    expect((await adminAuth().getUser(uid)).disabled).toBe(true)
    expect((await call(me, { method: 'GET', token })).status).toBe(401)

    const lifted = await applyAdminAction(admin, uid, 'unsuspend')
    expect(lifted.user).toMatchObject({ status: 'active' })
    expect((await adminAuth().getUser(uid)).disabled).toBe(false)
  })

  it('refuses to act on yourself or on admins', async () => {
    await expect(applyAdminAction(admin, admin.uid, 'ban')).rejects.toMatchObject({ status: 403 })
    const invited = await inviteAdmin(admin, { fullName: 'Ada Admin', email: 'ada@vorapicks.com' }, 'http://localhost:3000/admin/login')
    await expect(applyAdminAction(admin, invited.id, 'ban')).rejects.toMatchObject({ status: 403 })
  })

  it('invites an admin with a set-password link and rejects duplicates', async () => {
    const invited = await inviteAdmin(admin, inviteInput.parse({ fullName: 'Ada Admin', email: 'Ada@Vorapicks.com' }), 'http://localhost:3000/admin/login')
    expect(invited.email).toBe('ada@vorapicks.com')
    expect(invited.setPasswordLink).toContain('oobCode=')
    expect((await adminAuth().getUser(invited.id)).customClaims).toEqual({ role: 'admin' })
    await expect(inviteAdmin(admin, { fullName: 'Ada Again', email: 'ada@vorapicks.com' }, 'http://x')).rejects.toMatchObject({ code: 'email_in_use' })
  })
})
