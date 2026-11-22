"use client";

import { useState } from "react";
import { DateField } from "../../../date-field";
import { Submit } from "../../../components";
import { issueHomework } from "../../teacher-actions";

type Option = { id: string; title: string };
type LessonOption = { id: string; student: string; label: string };

export function IssueForm({ students, templates, lessons, initialStudent, initialLesson, initialTemplate }: {
  students: { id: string; name: string }[]; templates: Option[]; lessons: LessonOption[];
  initialStudent?: string; initialLesson?: string; initialTemplate?: string;
}) {
  const [student, setStudent] = useState(students.some(item => item.id === initialStudent) ? initialStudent! : students.length === 1 ? students[0].id : "");
  const relevant = lessons.filter(item => item.student === student);
  return <form className="editor" action={issueHomework}>
    <label>Ученик<select name="student" required value={student} onChange={event => setStudent(event.target.value)}>
      <option value="">Выберите ученика</option>
      {students.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    <label>Шаблон домашнего задания<select name="template" required defaultValue={templates.some(item => item.id === initialTemplate) ? initialTemplate : ""}>
      <option value="">Выберите из библиотеки</option>
      {templates.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
    </select></label>
    <label>Привязка к уроку<select key={student} name="lesson" defaultValue={relevant.some(item => item.id === initialLesson) ? initialLesson : ""}>
      <option value="">Отдельное задание</option>
      {relevant.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></label>
    <DateField name="deadline" label="Дедлайн (МСК)" withTime />
    <Submit pendingLabel="Выдаём…">Выдать ДЗ</Submit>
  </form>;
}
