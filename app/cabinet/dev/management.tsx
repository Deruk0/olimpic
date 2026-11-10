"use client";

import { useActionState, useState } from "react";
import { roles, type Role } from "../../../lib/model";
import { createManagedAccount, createManagedGroup, enrollManagedStudent, issueManagedInvite, type DevResult } from "./actions";

function Result({ result }: { result: DevResult }) {
  if (result.error) return <p className="notice error" role="alert">{result.error}</p>;
  return result.message ? <p className="notice" role="status">{result.message}</p> : null;
}

function InviteCode({ code }: { code: string }) {
  const [notice, setNotice] = useState("");
  return <div className="invite-code">
    <label>Код входа<input readOnly value={code} onFocus={event => event.currentTarget.select()} autoComplete="off" spellCheck={false} /></label>
    <button type="button" className="secondary" onClick={async () => {
      try { await navigator.clipboard.writeText(code); setNotice("Код скопирован."); }
      catch { setNotice("Выделите и скопируйте код из поля."); }
    }}>Скопировать код</button>
    {notice && <small role="status">{notice}</small>}
  </div>;
}

export function DevManagement({ accounts, groups }: {
  accounts: { id: string; name: string; role: Role; group_id: string | null }[];
  groups: { id: string; name: string }[];
}) {
  const [accountResult, createAccount, accountPending] = useActionState(createManagedAccount, { error: "" });
  const [groupResult, createGroup, groupPending] = useActionState(createManagedGroup, { error: "" });
  const [inviteResult, issueInvite, invitePending] = useActionState(issueManagedInvite, { error: "" });
  const [enrollResult, enrollStudent, enrollPending] = useActionState(enrollManagedStudent, { error: "" });
  const [role, setRole] = useState<Role>("student");
  const curators = accounts.filter(account => account.role === "curator");
  const ungrouped = accounts.filter(account => account.role === "student" && !account.group_id);
  return <>
    <div className="dev-management">
      <section className="panel">
        <h2>Создать аккаунт</h2>
        <form action={createAccount} className="editor">
          <label>Имя и фамилия<input name="name" required maxLength={120} autoComplete="off" /></label>
          <label>Роль<select name="role" value={role} onChange={event => setRole(event.target.value as Role)}>
            {Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          {role === "student" && <label>Группа<select name="group" defaultValue="">
            <option value="">Без группы</option>
            {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select></label>}
          <button disabled={accountPending}>{accountPending ? "Создание…" : "Создать аккаунт"}</button>
          <Result result={accountResult} />
        </form>
      </section>
      <section className="panel">
        <h2>Создать группу</h2>
        <form action={createGroup} className="editor">
          <label>Название группы<input name="name" required maxLength={120} /></label>
          <label>Куратор<select name="curator" required defaultValue="">
            <option value="" disabled>Выберите куратора</option>
            {curators.map(curator => <option key={curator.id} value={curator.id}>{curator.name}</option>)}
          </select></label>
          {!curators.length && <p className="muted">Сначала создайте аккаунт куратора.</p>}
          <button disabled={groupPending || !curators.length}>{groupPending ? "Создание…" : "Создать группу"}</button>
          <Result result={groupResult} />
        </form>
      </section>
    </div>
    <section className="panel">
      <h2>Добавить ученика в группу</h2>
      <form action={enrollStudent} className="editor">
        <div className="formgrid">
          <label>Ученик без группы<select name="student" required defaultValue="">
            <option value="" disabled>Выберите ученика</option>
            {ungrouped.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}
          </select></label>
          <label>Группа<select name="group" required defaultValue="">
            <option value="" disabled>Выберите группу</option>
            {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select></label>
        </div>
        {!ungrouped.length && <p className="muted">Все ученики уже распределены по группам.</p>}
        <button disabled={enrollPending || !ungrouped.length || !groups.length}>{enrollPending ? "Добавление…" : "Добавить в группу"}</button>
        <Result result={enrollResult} />
      </form>
    </section>
    <section className="panel">
      <h2>Приглашение в кабинет</h2>
      <form action={issueInvite} className="editor">
        <label>Аккаунт<select name="account" required defaultValue="">
          <option value="" disabled>Выберите получателя</option>
          {accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {roles[account.role]}</option>)}
        </select></label>
        <button disabled={invitePending}>{invitePending ? "Выдача кода…" : "Выдать одноразовый код"}</button>
        <Result result={inviteResult} />
      </form>
      {inviteResult.code && <InviteCode key={inviteResult.code} code={inviteResult.code} />}
    </section>
  </>;
}
