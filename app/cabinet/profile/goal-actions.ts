"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "../../../lib/auth";
import { rows } from "../../../lib/db";
import { materialImageType } from "../../../lib/material-image";
import { goalAdmissionPlans, goalCompetitions, goalDirections, goalImageLimit, goalKinds, goalResults, type StudentGoal } from "../../../lib/student-goal";

export async function saveStudentGoal(_state: { error: string }, form: FormData) {
  const user = await requireAccount("student");
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const kind = field("kind");
  const competition = field("competition");
  const result = field("result");
  const admission = field("admission");
  const directions = [...new Set(form.getAll("directions"))];

  if (!Object.hasOwn(goalKinds, kind)) return { error: "Выберите основную цель." };
  if ((competition && !Object.hasOwn(goalCompetitions, competition))
    || (result && !Object.hasOwn(goalResults, result))
    || (admission && !Object.hasOwn(goalAdmissionPlans, admission))
    || !directions.every((value): value is string => typeof value === "string" && Object.hasOwn(goalDirections, value))) {
    return { error: "Проверьте выбранные варианты." };
  }

  const reason = field("reason");
  const nextStep = field("nextStep");
  const university = field("university");
  const competitionName = competition === "listed" || competition === "other" ? field("competitionName") : "";
  if (reason.length > 600 || nextStep.length > 200 || university.length > 160 || competitionName.length > 160) {
    return { error: "Проверьте длину текстовых полей." };
  }

  const file = form.get("image");
  let image: Buffer | null = null;
  if (file instanceof File && file.size) {
    if (file.size > goalImageLimit) return { error: "Размер изображения должен быть до 2 МБ." };
    image = Buffer.from(await file.arrayBuffer());
    const type = materialImageType(image);
    if (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp") {
      return { error: "Выберите изображение в формате JPEG, PNG или WebP." };
    }
  }

  const details: StudentGoal = { kind, competition, competitionName, result, reason, nextStep, university, directions, admission };
  const removeImage = !image && form.get("removeImage") === "on";
  await rows(
    "INSERT INTO student_goal_profiles(student,details,image,image_version) VALUES ($1,$2,$3,$4) " +
    "ON CONFLICT(student) DO UPDATE SET details=EXCLUDED.details, " +
    "image=CASE WHEN $5 THEN NULL ELSE COALESCE(EXCLUDED.image,student_goal_profiles.image) END, " +
    "image_version=CASE WHEN $5 THEN NULL ELSE COALESCE(EXCLUDED.image_version,student_goal_profiles.image_version) END",
    [user.id, JSON.stringify(details), image, image && randomUUID(), removeImage]
  );
  revalidatePath("/cabinet/profile");
  redirect("/cabinet/profile?goal=saved#my-goal");
}
