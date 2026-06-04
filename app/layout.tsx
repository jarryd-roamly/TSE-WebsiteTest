import './globals.css';
import type { Metadata } from 'next';

// ─────────────────────────────────────────────────────────────────────────────
// Root layout — The Safari Edition
// Fonts loaded here once for the entire app via Google Fonts preconnect.
// All pages inherit: Cormorant Garamond (display) + Jost (body)
// Playfair Display kept for backward compatibility with any existing references.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'The Safari Edition — Africa\'s Finest Wilderness, Curated',
  description:
    'Handpicked lodges, contracted rates 15–27% below direct, expert sequencing. ' +
    'Build your perfect African safari in under 30 seconds.',
  openGraph: {
    title: 'The Safari Edition',
    description: 'Africa\'s finest wilderness, curated.',
    images: [{ url: '/og-image.jpg' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Safari Edition',
    description: 'Africa\'s finest wilderness, curated.',
    images: [{ url: '/og-image.jpg' }],
  },
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect for fastest font load */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Single font load for the entire app.
          Cormorant Garamond — display/headings/prices (replaces Playfair Display)
          Jost              — body/UI/labels (replaces DM Sans / Inter)
          Playfair Display  — kept for any remaining backward-compat references
        */}
        <link
         href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=Jost:wght@200;300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      {/*
        No className applied here — globals.css sets the correct base styles.
        Individual pages use inline styles or their own <style> blocks.
        This avoids Inter or any Next.js default font forcing its way in.
      */}
      <body>{children}</body>
    </html>
  );
}
