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

const legacyGoalResults = {
  advance: "Пройти на следующий этап",
  finalist: "Выйти в финал",
  prizewinner: "Стать призёром",
  winner: "Стать победителем",
} as const;

export const goalDirectionGroups: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "IT и цифровые технологии": {
    software: "Разработка программного обеспечения",
    ai: "Искусственный интеллект",
    data: "Анализ данных",
    cybersecurity: "Кибербезопасность",
    gameDevelopment: "Разработка игр",
  },
  "Инженерия и производство": {
    robotics: "Робототехника и автоматизация",
    electronics: "Электроника и микроэлектроника",
    mechanical: "Машиностроение и промышленное производство",
    space: "Авиация и космос",
    energy: "Энергетика",
    transport: "Транспорт и логистика",
  },
  "Наука и исследования": {
    appliedMath: "Прикладная математика и моделирование",
    physicsResearch: "Физические исследования",
    materials: "Химические технологии и новые материалы",
    biology: "Биология и генетика",
    environment: "Экология и науки о Земле",
  },
  "Медицина и здоровье": {
    medicine: "Клиническая медицина",
    pharmacy: "Фармацевтика",
    biotech: "Биотехнологии и биоинженерия",
    publicHealth: "Общественное здоровье",
  },
  "Экономика и бизнес": {
    economicAnalytics: "Экономическая аналитика",
    finance: "Финансы и инвестиции",
    entrepreneurship: "Предпринимательство",
    management: "Управление проектами и продуктами",
    marketing: "Маркетинг и реклама",
  },
  "Право и общество": {
    law: "Юриспруденция",
    government: "Государственное управление",
    diplomacy: "Международные отношения",
    socialResearch: "Социальные исследования",
  },
  "Образование и гуманитарные направления": {
    education: "Педагогика и образовательные технологии",
    psychology: "Психология",
    translation: "Лингвистика и перевод",
    culture: "История и культурные проекты",
  },
  "Медиа, дизайн и городская среда": {
    journalism: "Журналистика и медиа",
    design: "Графический и продуктовый дизайн",
    film: "Кино, анимация и видеопроизводство",
    architecture: "Архитектура и градостроительство",
    construction: "Строительство",
  },
  "Агроиндустрия и пищевые технологии": {
    agriculture: "Агротехнологии",
    foodTechnology: "Пищевые технологии",
    veterinary: "Ветеринария",
  },
  "Другие интересы": {
    other: "Другое направление",
  },
};

// Старые варианты остаются видимыми в сохранённых целях.
export const goalDirections: Readonly<Record<string, string>> = {
  mathematics: "Математика",
  technology: "Информатика и IT",
  physics: "Физика",
  engineering: "Инженерные науки",
  economics: "Экономика",
  ...Object.fromEntries(Object.values(goalDirectionGroups).flatMap(options => Object.entries(options))),
};

export const goalAdmissionPlans = {
  bvi: "БВИ в приоритете",
  flexible: "Рассматриваю БВИ и общий конкурс",
  general: "Рассчитываю на общий конкурс",
} as const;

export type StudentGoal = {
  kind: string;
  competition: string;
  competitionName: string;
  result?: string;
  resultText?: string;
  reason: string;
  university: string;
  directions: string[];
  admission: string;
};

export const emptyStudentGoal: StudentGoal = {
  kind: "", competition: "", competitionName: "", resultText: "", reason: "",
  university: "", directions: [], admission: "",
};

export const goalImageLimit = 2_000_000;
export const goalResultLimit = 300;
export const profileGoalPath = "/cabinet/profile#my-goal";
export const editProfileGoalPath = "/cabinet/profile?goal=edit#my-goal";

export function goalOptionLabel(options: Readonly<Record<string, string>>, value: string) {
  return Object.hasOwn(options, value) ? options[value] : "";
}

export function goalResultText(goal: StudentGoal) {
  return goal.resultText ?? goalOptionLabel(legacyGoalResults, goal.result ?? "");
}
