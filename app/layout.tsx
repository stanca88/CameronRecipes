import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cameron Family Recipes",
  description: "Family recipes, weekly meal planning, and one simple shopping list.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
