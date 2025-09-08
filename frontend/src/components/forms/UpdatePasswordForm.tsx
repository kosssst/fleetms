"use client";

import { Button, PasswordInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import classes from "../../styles/UpdatePasswordForm.module.scss";
import { updatePassword } from "@/services/user.service";

export const UpdatePasswordForm = () => {
  const form = useForm({
    initialValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },

    validate: {
      newPassword: (value) => (value.length >= 6 ? null : "Password must be at least 6 characters long"),
      confirmPassword: (value, values) => (value === values.newPassword ? null : "Passwords do not match"),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      const { currentPassword, newPassword } = values;
      await updatePassword({ currentPassword, newPassword });
      notifications.show({
        title: "Success",
        message: "Password updated successfully",
        color: "green",
      });
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to update password",
        color: "red",
      });
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} className={classes.form}>
      <PasswordInput label="Current Password" placeholder="Current Password" {...form.getInputProps("currentPassword")} />
      <PasswordInput label="New Password" placeholder="New Password" mt="md" {...form.getInputProps("newPassword")} />
      <PasswordInput
        label="Confirm New Password"
        placeholder="Confirm New Password"
        mt="md"
        {...form.getInputProps("confirmPassword")}
      />
      <Button type="submit" mt="md">
        Update Password
      </Button>
    </form>
  );
};
