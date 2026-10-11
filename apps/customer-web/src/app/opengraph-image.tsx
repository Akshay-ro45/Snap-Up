import { ImageResponse } from 'next/og';

/**
 * The link preview shown when SnapUp is shared — WhatsApp, X, Slack, iMessage.
 *
 * Drawn from the brand palette and the app's existing tagline, and nothing else: no
 * statistics, no store names, no claims the product does not already make on its own
 * home screen. Rendered once at build time.
 */
export const alt = 'SnapUp — Scan, Pay & Skip the Line';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 96px',
          background: '#00C4A7',
          color: '#052019',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              width: 112,
              height: 112,
              borderRadius: 28,
              background: '#052019',
              color: '#00C4A7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 72,
              fontWeight: 800,
            }}
          >
            S
          </div>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>SnapUp</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 56, fontWeight: 700 }}>Scan, Pay &amp; Skip the Line</div>
        <div style={{ marginTop: 20, fontSize: 32, opacity: 0.8, maxWidth: 900 }}>
          Scan barcodes, build your cart, and check out without the queue.
        </div>
      </div>
    ),
    size
  );
}
