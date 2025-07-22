"use client";

import {Header} from "@/components/headers/Header";
import { UserCardImage } from "@/components/containers/UserCardImage";
import WithAuth from "@/components/hoc/WithAuth";
import {Container} from "@mantine/core";

const ProfilePage = () => {
  return (
    <div>
      <Header />
      <Container>
        <UserCardImage />
      </Container>
    </div>
  );
};

export default WithAuth(ProfilePage);
