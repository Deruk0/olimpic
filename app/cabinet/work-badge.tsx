import { workStates } from "../../lib/work";

export function WorkBadge({ state }: { state: keyof typeof workStates }) {
  const style = state === "reviewed" ? " badge-success" : state === "overdue" ? " badge-danger" : "";
  return <span className={"badge" + style}>{workStates[state]}</span>;
}
