import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hanuman 3D Pipeline Tracker",
  description: "Asset pipeline tracking for Hanuman movie",
};

import { AuthProvider } from "@/lib/AuthContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50 dark:bg-black`}
      >
        <AuthProvider>
          <Navbar />
          <main className="w-full px-2 sm:px-4 lg:px-6 py-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
