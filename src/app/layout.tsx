import type { ReactNode } from "react";

import "@/styles/globals.css";
import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";

import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";

const open_sans = Open_Sans({ subsets: ["latin"] });
import "@coinbase/onchainkit/styles.css";

export const metadata: Metadata = {
  title: "EpheSafe",
  applicationName: "EpheSafe",
  description: "EpheSafe Asset Locker During Hacks",
  authors: {
    name: "Mohit",
    url: "",
  },
  icons: "ephesafe.png",
  manifest: "site.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={open_sans.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
