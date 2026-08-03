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

export const metadata: Metadata = {
  title: {
    default: "Davronbek Nabiev — IELTS Mock Tests",
    template: "%s · Davronbek Nabiev",
  },
  description:
    "Computer-delivered IELTS Academic mock tests and practice with instant scoring and band feedback.",
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
