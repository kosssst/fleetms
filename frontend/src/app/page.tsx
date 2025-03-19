"use client";

import withAuth from "@/components/hoc/WithAuth";
import { Header } from "../components/headers/Header";
import { Text } from "@mantine/core";

function Home() {
  return (
    <div>
      <Header />
      <Text ta="center" size="xl" style={{ marginTop: 20 }} fw={700}>Test Application</Text>
    </div>
  );
}

export default withAuth(Home);