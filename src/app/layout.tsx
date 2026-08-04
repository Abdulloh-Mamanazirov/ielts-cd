import type { Metadata } from "next";
import { Archivo, Archivo_Black, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin", "latin-ext"],
  weight: "400",
});

// Reading passages only — long-form exam text is easier on the eye set in serif.
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
});

const DESCRIPTION =
  "Computer-delivered IELTS Academic mock tests and practice with instant scoring and band feedback, from instructor Davronbek Nabiev in Tashkent, Uzbekistan.";

export const metadata: Metadata = {
  metadataBase: new URL("https://dn-ielts.uz"),
  title: {
    default: "Davronbek Nabiev — IELTS Mock Tests",
    template: "%s · Davronbek Nabiev",
  },
  description: DESCRIPTION,
  applicationName: "DN IELTS",
  authors: [{ name: "Davronbek Nabiev" }],
  creator: "Davronbek Nabiev",
  publisher: "Davronbek Nabiev",
  keywords: [
    "IELTS",
    "IELTS mock test",
    "IELTS Academic",
    "computer-delivered IELTS",
    "IELTS practice test",
    "IELTS band score",
    "IELTS Uzbekistan",
    "IELTS Tashkent",
    "Davronbek Nabiev",
    "DN IELTS",
  ],
  verification: {
    google: "EYx-D9y9nGs9B6uApjGffKotNU4QnzI4RY0MGDChFg8",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "DN IELTS — Davronbek Nabiev",
    title: "Davronbek Nabiev — IELTS Mock Tests",
    description: DESCRIPTION,
    url: "https://dn-ielts.uz",
    locale: "en_US",
    images: [{ url: "/logo.png", width: 1254, height: 1254, alt: "DN IELTS" }],
  },
  twitter: {
    card: "summary",
    title: "Davronbek Nabiev — IELTS Mock Tests",
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoBlack.variable} ${sourceSerif.variable} antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-surface-alt">{children}</body>
    </html>
  );
}
