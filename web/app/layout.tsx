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
      <body>
        <Providers>
          <NavBar />
          <main
            style={{
              maxWidth: 960,
              margin: "0 auto",
              padding: "24px 20px 80px",
            }}
          >
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
