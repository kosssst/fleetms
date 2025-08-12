"use client";

import withAuth from "@/components/hoc/WithAuth";
import { Header } from '@/components/layout/Header';
import { ReactNode } from "react";

function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container">
      <main className="main">
        <Header />
        {children}
      </main>
    </div>
  );
}

export default withAuth(ProtectedLayout);
