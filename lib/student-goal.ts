export const goalKinds = {
  bvi: "Поступить в вуз по БВИ",
  diploma: "Получить диплом олимпиады",
  skills: "Углубить знания по математике",
  explore: "Попробовать себя в олимпиадах",
} as const;

export const goalCompetitions = {
  vsosh: "ВсОШ по математике",
  listed: "Перечневая олимпиада",
  other: "Другая олимпиада",
} as const;

export const goalResults = {
  advance: "Пройти на следующий этап",
  finalist: "Выйти в финал",
  prizewinner: "Стать призёром",
  winner: "Стать победителем",
} as const;

export const goalDirections = {
  mathematics: "Математика",
  technology: "Информатика и IT",
  physics: "Физика",
  engineering: "Инженерные науки",
  economics: "Экономика",
  other: "Другое направление",
} as const;

export const goalAdmissionPlans = {
  bvi: "БВИ в приоритете",
  flexible: "Рассматриваю БВИ и общий конкурс",
  general: "Рассчитываю на общий конкурс",
} as const;

export type StudentGoal = {
  kind: string;
  competition: string;
  competitionName: string;
  result: string;
  reason: string;
  nextStep: string;
  university: string;
  directions: string[];
  admission: string;
};

export const emptyStudentGoal: StudentGoal = {
  kind: "", competition: "", competitionName: "", result: "", reason: "", nextStep: "",
  university: "", directions: [], admission: "",
};

export const goalImageLimit = 2_000_000;
export const profileGoalPath = "/cabinet/profile#my-goal";
export const editProfileGoalPath = "/cabinet/profile?goal=edit#my-goal";

export function goalOptionLabel(options: Readonly<Record<string, string>>, value: string) {
  return Object.hasOwn(options, value) ? options[value] : "";
}
