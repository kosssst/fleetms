"use client";

import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';



export default function RootLayout({ children, }: Readonly<{ children: React.ReactNode; }>) {
  return (
    <html lang="en" data-lt-installed="true">
      <body>
        <MantineProvider defaultColorScheme="dark">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
