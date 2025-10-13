import { Avatar, Button, Card, Text } from '@mantine/core';
import classes from '../../styles/UserCardImage.module.scss';
import {useAuth} from "@/context/AuthContext";
import {Loading} from "@/components/common/Loading";
import Cookies from "js-cookie";
import {USER_ROLE_DISPLAY_NAMES} from "@/constants/userRoles";


export function UserCardImage() {
  const { user , loading} = useAuth();

  const handleLogout = () => {
    Cookies.remove('token');
    localStorage.clear();
    window.location.href = '/';
  };

  if (loading || !user) {
    return <Loading />;
  }

  return (
    <Card withBorder padding="xl" radius="md" className={classes.card}>
      <Card.Section
        h={140}
        style={{
          backgroundImage: "url('profile-background.svg')",
          backgroundSize: "100%",
        }}
      />
      <Avatar
        name={`${user.firstName} ${user.lastName}`}
        color="initials"
        size={80}
        radius={80}
        mx="auto"
        mt={-30}
        className={classes.avatar}
        variant="default"
      />
      <Text ta="center" fz="lg" fw={500} mt="sm">
        {user.firstName} {user.lastName}
      </Text>
      <Text ta="center" fz="sm" c="dimmed">
        {USER_ROLE_DISPLAY_NAMES[user.role]}
      </Text>
      <Text ta="center" fz="sm" c="dimmed">
        {user.email}
      </Text>
      <Button fullWidth radius="md" mt="xl" size="md" variant="filled" onClick={handleLogout}>
        Logout
      </Button>
    </Card>
  );
}