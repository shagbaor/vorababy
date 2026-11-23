// Paystack sends the buyer here after a card payment. The app closes its
// payment screen as soon as it sees this address; in a browser this page
// simply says the payment was received.
export default function PaystackDone() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '64px 24px' }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Payment received</h1>
      <p style={{ color: '#6b7280' }}>You can go back to the Vorapicks app. We confirm your payment automatically.</p>
    </main>
  )
}
