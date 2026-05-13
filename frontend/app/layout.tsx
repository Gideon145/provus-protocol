import type { Metadata } from "next";
import { Orbitron, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  variable: "--font-hud",
  weight: "400",
});

export const metadata: Metadata = {
  title: "PROVUS Protocol — Verifiable Signal Engine on 0G",
  description:
    "Verifiable Signal Engine for autonomous AI trading on 0G. Every 15s a Qwen-2.5-7B reasoning trace is TEE-sealed and published on-chain. 75,000+ mainnet attestations. 3 of 5 0G components live.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${orbitron.variable} ${shareTechMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
