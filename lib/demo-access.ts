import type { Role } from "./model";

export const demoAccounts: Record<Role, string> = {
  student: "anna",
  teacher: "teacher-math"
};
export const demoLoginEnabled = () => process.env.OLIMPIK_DEMO_LOGIN === "true";
