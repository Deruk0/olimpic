import { createHash, randomBytes } from 'node:crypto';
import { database } from '../lib/db.mjs';
import { demoLessons, demoMaterials, demoMixedHomework, demoStudents, demoTeachers, demoVisitCards } from '../lib/demo.mjs';

const [command, ...args] = process.argv.slice(2);
if (command === 'local-demo' && process.env.DATABASE_URL) {
  throw new Error('Локальные демоданные можно создать только в PGlite.');
}
const db = await database();
const codes = [];

async function createAccount(tx, id, name, role) {
  const created = await tx.query('INSERT INTO accounts(id,name,role) VALUES ($1,$2,$3) ON CONFLICT(id) DO NOTHING RETURNING id',
    [id, name, role]);
  if (created.rows.length) return true;
  const { rows } = await tx.query('SELECT role FROM accounts WHERE id=$1', [id]);
  if (rows[0].role !== role) throw new Error('У аккаунта уже другая роль: ' + id);
  return false;
}

async function createTeacher(tx, id, name, subject) {
  await createAccount(tx, id, name, 'teacher');
  await tx.query('INSERT INTO teacher_profiles(teacher_id,subject) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, subject]);
}

async function issueInvite(tx, id, { reusable = false, teacher = null } = {}) {
  if (teacher) {
    const { rows } = await tx.query(
      "SELECT 1 FROM accounts a JOIN teacher_profiles t ON t.teacher_id=$2 WHERE a.id=$1 AND a.role='student'", [id, teacher]);
    if (!rows.length) throw new Error('Укажите существующих ученика и преподавателя.');
  }
  const code = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(code).digest('hex');
  if (reusable) {
    await tx.query("UPDATE invites SET expires=now() WHERE account=$1 AND reusable AND expires>now()", [id]);
  }
  await tx.query("INSERT INTO invites(hash,account,teacher_id,expires,reusable) VALUES ($1,$2,$3,now()+($4 * interval '1 day'),$5)",
    [hash, id, teacher, reusable ? 30 : 7, reusable]);
  codes.push([id, code]);
}

async function seed(tx) {
  for (const [id, name, subject] of demoTeachers) await createTeacher(tx, id, name, subject);
  for (const [id, name, teachers] of demoStudents) {
    if (await createAccount(tx, id, name, 'student')) {
      for (const teacher of teachers) {
        await tx.query('INSERT INTO teacher_students(teacher_id,student_id) VALUES ($1,$2)', [teacher, id]);
      }
    }
  }

  async function saveItem(teacher, id, kind, data) {
    await tx.query('INSERT INTO library_items(id,teacher_id,kind,title,ready,data) VALUES ($1,$2,$3,$4,true,$5) ON CONFLICT DO NOTHING',
      [id, teacher, kind, data.title, JSON.stringify(data)]);
  }

  const materials = new Map();
  for (const { key, teacher, exam, topic, theory, tasks } of demoMaterials) {
    const theoryId = `demo-${key}-theory`;
    const title = `${exam} · ${topic}`;
    const settings = { instructions: 'Выполните задания после занятия.', dueDays: 3 };
    const entries = tasks.map((task, index) => ({ id: `demo-${key}-task-${index + 1}`, task }));
    await saveItem(teacher, theoryId, 'theory', { title, topic, theory });
    for (const { id, task } of entries) await saveItem(teacher, id, 'task', { ...task, theoryId });
    await saveItem(teacher, `demo-${key}-homework`, 'work', { title, topic, kind: 'homework', settings, tasks: entries });
    materials.set(key, { teacher, content: {
      title, topic, theory, tasks: tasks.map(task => ({ ...task, kind: 'homework' })),
      work: { homework: { ...settings, title: `ДЗ · ${topic}` } }
    } });
  }

  for (const { id, material, student, days, hour, sampleSubmission } of demoLessons) {
    const { teacher, content } = materials.get(material);
    const starts = new Date();
    starts.setUTCHours(hour, 0, 0, 0);
    starts.setUTCDate(starts.getUTCDate() + days);
    await tx.query('INSERT INTO assignments(id,teacher_id,student_id,content,starts,settings) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
      [id, teacher, student, JSON.stringify(content), starts.toISOString(), JSON.stringify({ format: 'self', duration: 60 })]);
    if (sampleSubmission) {
      const answers = { 0: [1], 1: '1' };
      const grades = [
        { score: 1, comment: 'Верно.' },
        { score: 1, comment: 'Верно. Проверка подстановкой подтверждает корень.' },
        null
      ];
      await tx.query('INSERT INTO submissions(assignment,student,answers,grades,submitted) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
        [id, student, JSON.stringify(answers), JSON.stringify(grades), starts.toISOString()]);
    }
  }

  const mixed = demoMixedHomework;
  const numeric = mixed.tasks[1];
  await saveItem('teacher-math', numeric.id, 'task', { ...numeric.task, theoryId: 'demo-math-theory' });
  await saveItem('teacher-math', 'demo-math-mixed-template', 'work', mixed);
  const content = {
    title: mixed.title, topic: mixed.topic, theory: '',
    tasks: mixed.tasks.map(({ task }) => ({ ...task, kind: 'homework' })),
    work: { homework: { title: mixed.title, ...mixed.settings } }
  };
  await tx.query(`INSERT INTO assignments(id,teacher_id,student_id,content,starts,entry_kind,due_at)
    VALUES ('demo-math-mixed-homework','teacher-math','anna',$1,now(),'homework',now()+interval '3 days') ON CONFLICT DO NOTHING`,
    [JSON.stringify(content)]);

  await tx.query(`INSERT INTO assignments(id,teacher_id,student_id,content,starts,settings)
    VALUES ('demo-video-lesson','teacher-math','anna',$1,now()-interval '2 minutes',$2)
    ON CONFLICT (id) DO UPDATE SET starts=EXCLUDED.starts
    WHERE assignments.settings->>'format'='online' AND assignments.cancelled_at IS NULL
      AND assignments.starts + COALESCE((assignments.settings->>'duration')::int,90) * interval '1 minute' <= now()`,
    [JSON.stringify({ title: 'Демо · Видеоурок', topic: 'Разбор задач', theory: '', tasks: [] }),
      JSON.stringify({ format: 'online', duration: 90 })]);

  for (const { teacher, subjects, description, rate, hours } of demoVisitCards) {
    await tx.query('SELECT teacher_id FROM teacher_profiles WHERE teacher_id=$1 FOR UPDATE', [teacher]);
    await tx.query(`UPDATE teacher_profiles SET subjects=$2,description=$3,hourly_rate=$4
      WHERE teacher_id=$1 AND hourly_rate IS NULL`, [teacher, subjects, description, rate]);
    const { rows: [existing] } = await tx.query(`SELECT count(*)::int AS count FROM teacher_slots
      WHERE teacher_id=$1 AND starts>now()`, [teacher]);
    if (existing.count > 0) continue;
    for (const [index, hour] of hours.entries()) {
      const starts = new Date();
      starts.setUTCHours(hour, 0, 0, 0);
      starts.setUTCDate(starts.getUTCDate() + index + 1);
      const time = starts.toISOString();
      await tx.query(`INSERT INTO teacher_slots(id,teacher_id,starts)
        SELECT $1,$2,$3::timestamptz WHERE NOT EXISTS (
          SELECT 1 FROM assignments a WHERE a.teacher_id=$2 AND a.entry_kind='lesson' AND a.cancelled_at IS NULL
            AND a.starts < $3::timestamptz + interval '1 hour'
            AND a.starts + COALESCE((a.settings->>'duration')::int,60) * interval '1 minute' > $3::timestamptz
        ) ON CONFLICT DO NOTHING`, [`demo-slot-${teacher}-${time.slice(0, 10)}`, teacher, time]);
    }
  }
}

try {
  await db.transaction(async tx => {
    if (['seed', 'demo', 'local-demo'].includes(command) && args.length === 0) {
      await seed(tx);
      if (command !== 'local-demo') {
        for (const [id] of [...demoTeachers, ...demoStudents]) await issueInvite(tx, id, { reusable: command === 'demo' });
      }
    } else if (command === 'invite' && (args.length === 1 || args.length === 2)) {
      await issueInvite(tx, args[0], { teacher: args[1] });
    } else if (command === 'account') {
      const [id, role, name, subject] = args;
      if (!id || !name || !((role === 'teacher' && args.length === 4 && subject) || (role === 'student' && args.length === 3))) {
        throw new Error('Команда: account ID student "Имя" или account ID teacher "Имя" "Предмет".');
      }
      if (role === 'teacher') await createTeacher(tx, id, name, subject);
      else await createAccount(tx, id, name, role);
      await issueInvite(tx, id);
    } else {
      throw new Error('Команды: seed | demo | local-demo | invite ID [TEACHER_ID] | account ID ROLE "Имя" [ПРЕДМЕТ]');
    }
  });
  for (const [id, code] of codes) process.stdout.write(id + ': ' + code + '\n');
} finally {
  await db.close();
}
