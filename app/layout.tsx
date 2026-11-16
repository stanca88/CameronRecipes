import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cameron Family Recipes",
  description: "Family recipes, weekly meal planning, and one simple shopping list.",
  icons: {
    icon: "/favicon.svg?v=2",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
