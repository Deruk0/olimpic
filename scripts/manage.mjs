import { createHash, randomBytes } from 'node:crypto';
import { database } from '../lib/db.mjs';
import { demoPrograms } from '../lib/demo.mjs';

const [command, ...args] = process.argv.slice(2);
const demoStudents = [
  ['anna', 'Анна Соколова'], ['boris', 'Борис Орлов'], ['vera', 'Вера Лебедева'],
  ['gleb', 'Глеб Смирнов'], ['dina', 'Дина Морозова']
];
const db = await database();
const codes = [];
async function createAccount(tx, id, name, role) {
  await tx.query('INSERT INTO accounts(id,name,role) VALUES ($1,$2,$3) ON CONFLICT(id) DO NOTHING', [id, name, role]);
  const { rows } = await tx.query('SELECT role FROM accounts WHERE id=$1', [id]);
  if (rows[0].role !== role) throw new Error('Аккаунт уже существует с другой ролью: ' + id);
}
async function invite(tx, id, reusable = false) {
  const code = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(code).digest('hex');
  if (reusable) {
    await tx.query("UPDATE invites SET expires=now() WHERE account=$1 AND reusable AND expires>now()", [id]);
  }
  await tx.query("INSERT INTO invites(hash,account,expires,reusable) VALUES ($1,$2,now()+($3 * interval '1 day'),$4)", [hash, id, reusable ? 30 : 7, reusable]);
  codes.push([id, code]);
}
async function group(tx, id, name, curator) {
  const { rows } = await tx.query("SELECT 1 FROM accounts WHERE id=$1 AND role='curator'", [curator]);
  if (!rows.length) throw new Error('Сначала создайте аккаунт куратора.');
  await tx.query('INSERT INTO groups VALUES ($1,$2,$3) ON CONFLICT(id) DO NOTHING', [id, name, curator]);
  const existing = await tx.query('SELECT curator FROM groups WHERE id=$1', [id]);
  if (existing.rows[0].curator !== curator) throw new Error('Эта группа уже назначена другому куратору.');
}
async function enroll(tx, student, groupId) {
  await tx.query('INSERT INTO members VALUES ($1,$2) ON CONFLICT(student) DO NOTHING', [student, groupId]);
  const existing = await tx.query('SELECT group_id FROM members WHERE student=$1', [student]);
  if (existing.rows[0].group_id !== groupId) throw new Error('Ученик уже состоит в другой группе.');
}
try {
  await db.transaction(async tx => {
    if (command === 'seed' || command === 'demo') {
      await createAccount(tx, 'methodist', 'Мария Кузнецова', 'methodist');
      await createAccount(tx, 'curator', 'Илья Волков', 'curator');
      await group(tx, 'demo', 'Олимпиадная математика · 8–9 классы', 'curator');
      for (const [id, name] of demoStudents) {
        await createAccount(tx, id, name, 'student');
        await enroll(tx, id, 'demo');
      }
      for (const [level, program] of Object.entries(demoPrograms)) {
        await tx.query('INSERT INTO programs(level,draft) VALUES ($1,$2) ON CONFLICT(level) DO NOTHING', [level, JSON.stringify(program)]);
      }
      if (command === 'seed') {
        for (const id of ['methodist', 'curator', ...demoStudents.map(([id]) => id)]) await invite(tx, id);
      } else {
        for (const [level, program] of Object.entries(demoPrograms)) {
          await tx.query('UPDATE programs SET published=$2 WHERE level=$1 AND published IS NULL', [level, JSON.stringify(program)]);
        }
        const sample = demoPrograms.basic.lessons[0];
        const content = {
          ...sample,
          tasks: sample.tasks.map((task, index) => ({ ...task, phase: index ? 'after' : 'before' })),
          materials: [{ title: 'Памятка по делимости', kind: 'text', phase: 'before', value: 'Запишите число в виде mq+r, где 0 ≤ r < m. Разберите каждый остаток. В конце объясните, как перебор покрывает все целые числа.' }]
        };
        await tx.query("INSERT INTO assignments(id,group_id,kind,level,content,starts,meeting,settings) VALUES ('demo-sample-lesson','demo','lesson','basic',$1,date_trunc('day',now())+interval '3 days 15 hours','',$2) ON CONFLICT(id) DO NOTHING",
          [JSON.stringify(content), JSON.stringify({ format: 'self', duration: 90, location: '', recording: '' })]);
        for (const id of ['anna', 'curator', 'methodist']) await invite(tx, id, true);
      }
    } else if (command === 'invite' && args.length === 1) {
      await invite(tx, args[0]);
    } else if (command === 'group' && args.length === 3) {
      await group(tx, ...args);
    } else if (command === 'account' && args.length >= 3) {
      const [id, role, name, groupId] = args;
      if (!['student', 'curator', 'methodist'].includes(role) || (role === 'student' ? args.length !== 4 : args.length !== 3)) {
        throw new Error('Для ученика требуется ID существующей группы.');
      }
      await createAccount(tx, id, name, role);
      if (role === 'student') await enroll(tx, id, groupId);
      await invite(tx, id);
    } else {
      throw new Error('Команды: seed | demo | invite ID | group ID "Название" CURATOR_ID | account ID ROLE "Имя" [GROUP_ID]');
    }
  });
  for (const [id, code] of codes) process.stdout.write(id + ': ' + code + '\n');
} finally {
  await db.close();
}
