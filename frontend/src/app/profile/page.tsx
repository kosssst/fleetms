"use client";

import {Header} from "@/components/headers/Header";
import { UserCardImage } from "@/components/containers/UserCardImage";
import WithAuth from "@/components/hoc/WithAuth";
import {Accordion, Container, Grid} from "@mantine/core";
import { UpdateUserDataForm } from "@/components/forms/UpdateUserDataForm";
import { UpdatePasswordForm } from "@/components/forms/UpdatePasswordForm";
import { useAuth } from "@/context/AuthContext";

const ProfilePage = () => {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <Header />
      <Container>
        <Grid>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <UserCardImage />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Accordion variant="separated">
              <Accordion.Item value="update-profile">
                <Accordion.Control>
                  Update profile information
                </Accordion.Control>
                <Accordion.Panel>
                  <UpdateUserDataForm user={user} />
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value="update-password">
                <Accordion.Control>
                  Update password
                </Accordion.Control>
                <Accordion.Panel>
                  <UpdatePasswordForm />
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Grid.Col>
        </Grid>
      </Container>
    </div>
  );
};

export default WithAuth(ProfilePage);
