import { workStates } from "../../lib/work";

const stateStyles = {
  pending: "badge-neutral",
  awaiting: "badge-warning",
  reviewed: "badge-success",
  overdue: "badge-danger",
} satisfies Record<keyof typeof workStates, string>;

export function WorkBadge({ state }: { state: keyof typeof workStates }) {
  return <span className={"badge " + stateStyles[state]}>{workStates[state]}</span>;
}
