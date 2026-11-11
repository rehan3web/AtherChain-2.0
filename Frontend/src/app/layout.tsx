import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/components/theme-provider"
import { AlertProvider } from "@/providers/AlertProvider";
import { Toaster } from "@/components/ui/sonner";
import { ProgressBar } from "@/components/ProgressBar";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ather Network Mining",
  description: "Advanced crypto mining terminal",
  icons: {
    icon: "/link.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased min-h-screen bg-background text-foreground font-body">
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AlertProvider>
              <ProgressBar />
              <ServiceWorkerRegistration />
              {children}
              <Toaster />
            </AlertProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
