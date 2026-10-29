import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BFE • Sistema de Comando e Patentes (1º B F ESP)",
  description: "Dashboard Administrativa e Verificação OAuth 2.0 Roblox <-> Discord da BFE",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
