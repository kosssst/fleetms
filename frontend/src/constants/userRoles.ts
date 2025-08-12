import { UserRole } from "@/types/user.types";

export const USER_ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  user: "User",
  company_owner: "Owner",
  admin: "Administrator",
  logist: "Logist",
  driver: "Driver",
};
