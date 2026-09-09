import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { AppHeader, AppFooter } from "@/components/AppShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "eBPF Incident Lab",
  description: "Learn eBPF by investigating bounded Linux incidents with Rust and Aya.",
  metadataBase: new URL("https://ebpf-lab.danielasaboro.com"),
  openGraph: { title: "eBPF Incident Lab", description: "Production symptoms. Kernel evidence. Honest conclusions.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${mono.variable}`}>
        <a className="skip-link" href="#main">Skip to content</a>
        <AppHeader />
        {children}
        <AppFooter />
      </body>
    </html>
  );
}
