export const lessonPath = (id: string) => "/cabinet/lessons/" + encodeURIComponent(id);
export const homeworkPath = (id: string) => "/cabinet/homework/" + encodeURIComponent(id);
export const workPath = (id: string, kind: WorkKind) => "/cabinet/work/" + encodeURIComponent(id) + "/" + kind;
export const managementPath = (section: string, id: string, student?: string, kind?: WorkKind) =>
  "/cabinet/manage/" + encodeURIComponent(section) + "/" + encodeURIComponent(id) + (student ? "?student=" + encodeURIComponent(student) + (kind ? "&kind=" + kind : "") : "");
import type { WorkKind } from "./model";
