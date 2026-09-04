import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SchoolLint — Public information audit",
  description: "Find conflicting, stale, and broken information across school websites and public documents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
