import { demoAccounts, demoLoginEnabled } from "../lib/demo-access";
import { roles, type Role } from "../lib/model";
import { demoSignIn } from "./actions";

export function DemoRoles({ current }: { current?: Role }) {
  if (!demoLoginEnabled()) return null;
  return <div className="demo-roles">
    <p className="eyebrow">Тестовый доступ · выбрать роль</p>
    <form action={demoSignIn} className="controls">
      {(Object.keys(demoAccounts) as Role[]).map(role =>
        <button key={role} className={role === current ? "" : "secondary"} name="role" value={role} disabled={role === current}>{roles[role]}</button>
      )}
    </form>
  </div>;
}
