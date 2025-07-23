"use client";

import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { PROJECT_NAME} from "@/constants/appConfig";


import { AuthProvider } from '@/context/AuthContext';

export default function RootLayout({ children, }: Readonly<{ children: React.ReactNode; }>) {
  return (
    <html lang="en" data-lt-installed="true" suppressHydrationWarning={true}>
      <head>
        <title>{PROJECT_NAME}</title>
      </head>
      <body>
        <MantineProvider defaultColorScheme="dark">
          <AuthProvider>
            {children}
          </AuthProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
