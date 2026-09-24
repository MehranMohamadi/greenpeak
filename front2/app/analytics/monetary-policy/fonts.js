import { Inter, Vazirmatn } from "next/font/google"

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-monetary-vazirmatn",
})

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-monetary-inter",
})

export const monetaryFontVariables = `${vazirmatn.variable} ${inter.variable}`
