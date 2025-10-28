import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Avatar Forge | Photorealistic Avatar Authoring",
  description:
    "Create photorealistic, physically-based avatars with precise anatomical controls, responsive physics, and export-ready rigs.",
  metadataBase: new URL("https://agentic-b04d0cc3.vercel.app"),
  openGraph: {
    title: "Avatar Forge",
    description:
      "Design photorealistic avatars with PBR rendering, physics-ready hair and garments, and export to glTF or FBX in one click.",
    url: "https://agentic-b04d0cc3.vercel.app",
    siteName: "Avatar Forge",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Avatar Forge",
    description:
      "Generate photorealistic avatars with detailed anatomical controls and physically simulated hair and clothing.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-slate-950">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-950 text-slate-100 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
