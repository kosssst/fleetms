"use client";

import {CompanyInfoModule} from "@/components/containers/CompanyInfo.module";
import {Paper} from "@mantine/core";

const CompanyPage = () => {
  return (
    <Paper withBorder p="md" mt="md" radius="md">
      <CompanyInfoModule/>
    </Paper>
  )
}

export default CompanyPage;
