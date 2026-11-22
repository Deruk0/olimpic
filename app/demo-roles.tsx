import { demoAccounts, demoLoginEnabled } from "../lib/demo-access";
import { roles, type Role } from "../lib/model";
import { demoSignIn } from "./actions";

export function DemoRoles({ current, teacher }: { current?: Role; teacher?: string }) {
  if (!demoLoginEnabled()) return null;
  return <div className="demo-roles">
    <p className="eyebrow">Демо-доступ</p>
    <div className="demo-role-actions">
      <form action={demoSignIn} className="controls">
        {teacher && <input type="hidden" name="teacher" value={teacher} />}
        {(Object.keys(demoAccounts) as Role[]).map(role =>
          <button key={role} className={role === current ? "" : "secondary"} name="role" value={role} disabled={role === current}>{roles[role]}</button>
        )}
      </form>
      <form action={demoSignIn} className="controls">
        {teacher && <input type="hidden" name="teacher" value={teacher} />}
        <input type="hidden" name="demoStudent" value="dina" />
        <button className="secondary" name="role" value="student">Ученик · Дина</button>
      </form>
    </div>
  </div>;
}
