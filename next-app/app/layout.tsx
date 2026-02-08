import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Font Awesome SSR config
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Car Rental – Rent a Car Today",
  description: "Experience the road like never before. Rent premium cars at affordable prices.",
  themeColor: "#6366F1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className={`${inter.variable} font-sans bg-white text-gray-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
