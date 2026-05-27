import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/nav-bar";

export const metadata: Metadata = {
  title: "Nutrition Experiment Lab",
  description: "A private lab notebook for n-of-1 nutrition experiments.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-base text-ink antialiased">
        <Providers>
          <NavBar />
          <main className="mx-auto max-w-3xl px-5 pb-20 pt-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
