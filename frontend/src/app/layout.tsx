"use client";

import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import './globals.css';
import { PROJECT_NAME } from "@/constants/appConfig";
import { AuthProvider } from '@/context/AuthContext';
import { Notifications } from "@mantine/notifications";

export default function RootLayout({ children, }: Readonly<{ children: React.ReactNode; }>) {
  return (
    <html lang="en" data-lt-installed="true" suppressHydrationWarning={true}>
      <head>
        <title>{PROJECT_NAME}</title>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider>
          <Notifications />
          <AuthProvider>
            {children}
          </AuthProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
