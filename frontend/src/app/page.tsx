"use client";

import withAuth from "@/components/hoc/WithAuth";
import { Header } from "@/components/headers/Header";

function Home() {
  return (
    <div>
      <Header />
    </div>
  );
}

export default withAuth(Home);
