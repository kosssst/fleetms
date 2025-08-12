"use client";

import WithAuth from "@/components/hoc/WithAuth";
import {Header} from "../../components/headers/Header";
import {CompanyInfoBox} from "../../components/containers/CompanyInfoBox";

const CompanyPage = () => {
  return (
    <div>
      <Header />
      <CompanyInfoBox />
    </div>
  )

}

export default WithAuth(CompanyPage);