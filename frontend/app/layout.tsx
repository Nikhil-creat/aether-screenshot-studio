import "./globals.css";
import type { Metadata } from "next";
import AuthorBadge from "@/components/AuthorBadge";
export const metadata: Metadata = {
  title: "Aether AI Screenshot Studio",
  description: "Autonomous, private, self-healing screenshot intelligence — designed & built by Nikhil Chary Sriramoju.",
  authors: [{ name: "Nikhil Chary Sriramoju", url: "https://github.com/Nikhil-creat" }],
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>
      <header className="sticky top-0 z-30 border-b border-edge bg-ink/70 backdrop-blur-xl">
        <div className="mx-auto max-w-[1500px] px-5 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-semibold text-white">
            <span className="h-6 w-6 rounded-md bg-gradient-to-br from-neon via-aether-500 to-plasma animate-float" />Aether <span className="text-slate-500 font-normal">Studio</span>
          </a>
          <AuthorBadge compact />
        </div>
      </header>
      {children}
      <footer className="border-t border-edge mt-10 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Aether AI Screenshot Studio · Designed &amp; built by <a className="text-slate-300 hover:text-white" href="/about">Nikhil Chary Sriramoju</a>
      </footer>
    </body></html>
  );
}
