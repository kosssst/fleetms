"use client";

import withAuth from "@/components/hoc/WithAuth";
import { Header } from "@/components/headers/Header";
import {CompanyInfoBox} from "@/components/containers/CompanyInfoBox";

function Home() {
  return (
    <div>
      <Header />
      <CompanyInfoBox />
    </div>
  );
}

export default withAuth(Home);
