export const demoTeachers = [
  ['teacher-math', 'Мария Кузнецова', 'Математика'],
  ['teacher-russian', 'Елена Воронцова', 'Русский язык'],
  ['teacher-informatics', 'Илья Волков', 'Информатика']
];

export const demoVisitCards = [
  {
    teacher: 'teacher-math',
    subjects: ['Математика', 'Алгебра', 'Геометрия'],
    rate: 1700,
    description: 'Готовлю к ОГЭ и ЕГЭ по математике. За 8 лет занятий заметила, что результаты растут быстрее, когда ученик может объяснить ход решения. Поэтому на уроке разбираем задачи, а дома закрепляем их на коротких работах.\n\nПомогу закрыть пробелы в алгебре и геометрии, разобрать сложные задания и составить план подготовки.',
    hours: [15, 16, 14]
  },
  {
    teacher: 'teacher-russian',
    subjects: ['Русский язык'],
    rate: 1500,
    description: 'Шесть лет готовлю школьников к ОГЭ и ЕГЭ по русскому языку. Разбираем орфографию, пунктуацию и задания с паронимами, а за сочинение даю комментарии по критериям экзамена.\n\nНа первом уроке вместе определим, какие темы требуют больше практики.',
    hours: [14, 16, 13]
  },
  {
    teacher: 'teacher-informatics',
    subjects: ['Информатика', 'Программирование'],
    rate: 1900,
    description: 'Помогаю подготовиться к ЕГЭ по информатике и начать писать программы на Python. Объясняю алгоритмы на примерах, с которыми встречается ученик: таблицы, поиск данных и обработка строк.\n\nНа занятиях пишем и проверяем решения вместе. Между уроками даю короткие задания на темы, где чаще возникают ошибки.',
    hours: [16, 15, 14]
  }
];

export const demoStudents = [
  ['anna', 'Анна Соколова', ['teacher-math', 'teacher-russian']],
  ['boris', 'Борис Орлов', ['teacher-math']],
  ['vera', 'Вера Лебедева', ['teacher-informatics']],
  ['dina', 'Дина Морозова', []]
];

const topic = {
  math: 'Квадратные уравнения',
  russian: 'Паронимы',
  informatics: 'Электронные таблицы'
};

function withFormulas(text) {
  const content = text.split(/\$([^$]+)\$/).flatMap((part, index) => {
    if (!part) return [];
    return index % 2 ? [{ type: 'mathFormula', attrs: { latex: part, display: false } }] : [{ type: 'text', text: part }];
  });
  return 'olimpik-rich:' + JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content }] });
}

const math = [
  {
    title: 'Сколько корней?',
    topic: topic.math,
    prompt: withFormulas('Сколько действительных корней у уравнения $x^2-6x+9=0$?'),
    response: 'single',
    options: ['Ни одного', 'Один', 'Два'],
    correct: [1],
    max: 1
  },
  {
    title: 'Корень уравнения',
    topic: topic.math,
    prompt: withFormulas('Найдите меньший корень уравнения $2x^2-7x+5=0$. В ответ запишите число.'),
    response: 'text',
    modelAnswer: '1',
    max: 1
  },
  {
    title: 'Задача на площадь',
    topic: topic.math,
    prompt: 'Длина прямоугольника на 3 см больше ширины, а площадь равна 40 см². Найдите размеры. Запишите решение в тетради и приложите фото.',
    response: 'file',
    rubric: 'Составлено уравнение, найден положительный корень, указаны обе стороны.',
    max: 2
  }
];
const russian = [
  {
    title: 'Употребление паронимов',
    topic: topic.russian,
    prompt: 'Выберите предложение, где выделенное слово употреблено верно.',
    response: 'single',
    options: [
      'Преподаватель НАДЕЛ куртку перед выходом.',
      'На уроке обсудили ЭФФЕКТИВНУЮ внешность героя.',
      'Ученица ОДЕЛА пальто и вышла из дома.'
    ],
    correct: [0],
    max: 1
  },
  {
    title: 'Исправьте слово',
    topic: topic.russian,
    prompt: 'Замените выделенное слово подходящим паронимом: «У героини была ЭФФЕКТИВНАЯ внешность». Запишите исправленное слово.',
    response: 'short',
    answerKey: { format: 'text', values: ['эффектная'] },
    max: 1
  }
];
const informatics = [
  {
    title: 'Сумма ячеек',
    topic: topic.informatics,
    prompt: 'В ячейках A1, A2 и A3 записаны числа 7, 12 и 5. Какое значение вернёт формула =СУММ(A1:A3)?',
    response: 'text',
    modelAnswer: '24',
    max: 1
  },
  {
    title: 'Копирование формулы',
    topic: topic.informatics,
    prompt: 'Какой вид примет формула =A1+$B$1, если скопировать её из C1 в C2?',
    response: 'single',
    options: ['=A1+$B$1', '=A2+$B$1', '=A2+$B$2'],
    correct: [1],
    max: 1
  }
];

export const demoMaterials = [
  {
    key: 'math', teacher: 'teacher-math', exam: 'ОГЭ', topic: topic.math,
    theory: withFormulas('Для $ax^2+bx+c=0$ вычислите $D=b^2-4ac$. При $D=0$ уравнение имеет один действительный корень.'),
    tasks: math
  },
  {
    key: 'russian', teacher: 'teacher-russian', exam: 'ЕГЭ', topic: topic.russian,
    theory: 'Паронимы похожи по звучанию, но различаются по значению. Эффектный привлекает внимание, эффективный даёт нужный результат.',
    tasks: russian
  },
  {
    key: 'informatics', teacher: 'teacher-informatics', exam: 'ЕГЭ', topic: topic.informatics,
    theory: 'Относительные ссылки при копировании меняются, а знаком доллара можно закрепить столбец или строку. Например, ссылка $B$1 полностью абсолютная.',
    tasks: informatics
  }
];

export const demoLessons = [
  { id: 'demo-math-review', material: 'math', student: 'anna', days: -3, hour: 14, sampleSubmission: true },
  { id: 'demo-math-lesson', material: 'math', student: 'boris', days: 1, hour: 14 },
  { id: 'demo-russian-lesson', material: 'russian', student: 'anna', days: 1, hour: 15 },
  { id: 'demo-informatics-lesson', material: 'informatics', student: 'vera', days: 2, hour: 14 }
];

const decimalTask = {
  title: 'Больший корень уравнения',
  topic: topic.math,
  prompt: withFormulas('Найдите больший корень уравнения $2x^2-7x+5=0$. В ответ запишите число.'),
  response: 'short',
  answerKey: { format: 'number', values: ['2,5'] },
  max: 1
};
export const demoMixedHomework = {
  title: 'ОГЭ · Смешанное ДЗ',
  topic: topic.math,
  kind: 'homework',
  settings: { instructions: 'Выберите ответ в первой задаче, запишите число во второй и приложите фото решения третьей.' },
  tasks: [
    { id: 'demo-math-task-1', task: math[0] },
    { id: 'demo-math-decimal', task: decimalTask },
    { id: 'demo-math-task-3', task: math[2] }
  ]
};
