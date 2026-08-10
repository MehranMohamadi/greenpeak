// import { Inter } from "next/font/google";
import "./globals.css";
import "../styles/animations.css";
import { ClientShell } from "@/components/layout/client-shell";

// const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "GreenPeak Dashboard",
  description: "A comprehensive S&P 500 analytics and trading dashboard",
  generator: "Mohammad Shabani",
  icons: {
    icon: "/favico.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
