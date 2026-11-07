import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulse — Your daily mood",
  description: "A little space to check in. Track your daily mood and see your days over time.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
