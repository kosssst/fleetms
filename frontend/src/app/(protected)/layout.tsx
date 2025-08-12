"use client";

import withAuth from "@/components/hoc/WithAuth";
import { Header } from '@/components/layout/Header';
import { ReactNode } from "react";

function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}

export default withAuth(ProtectedLayout);
