"use client";

import { Button, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import classes from "../../styles/UpdateUserDataForm.module.scss";
import { updateUserData } from "@/services/user.service";
import { useAuth } from "@/context/AuthContext";
import {UpdateUserData, User} from "@/types/user.types";

interface UpdateUserDataFormProps {
  user: User;
}

export const UpdateUserDataForm = ({ user }: UpdateUserDataFormProps) => {
  const { setUser } = useAuth();
  const form = useForm({
    initialValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },

    validate: {
      email: (value) => (/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(value) ? null : "Invalid email"),
    },
  });

  const handleSubmit = async (values: UpdateUserData) => {
    try {
      const updatedUser = await updateUserData(values);
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      notifications.show({
        title: "Success",
        message: "User data updated successfully",
        color: "green",
      });
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to update user data",
        color: "red",
      });
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} className={classes.form}>
      <TextInput label="First Name" placeholder="First Name" {...form.getInputProps("firstName")} />
      <TextInput label="Last Name" placeholder="Last Name" mt="md" {...form.getInputProps("lastName")} />
      <TextInput label="Email" placeholder="Email" mt="md" {...form.getInputProps("email")} />
      <Button type="submit" mt="md">
        Update
      </Button>
    </form>
  );
};
