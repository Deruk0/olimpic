export const lessonPath = (id: string) => "/cabinet/lessons/" + encodeURIComponent(id);
export const roomPath = (id: string) => "/cabinet/room/" + encodeURIComponent(id);
export const homeworkPath = (id: string) => "/cabinet/homework/" + encodeURIComponent(id);
export const workPath = (id: string, kind: WorkKind) => "/cabinet/work/" + encodeURIComponent(id) + "/" + kind;
export const reviewPath = (id: string, kind: WorkKind) => "/cabinet/review/" + encodeURIComponent(id) + "/" + kind;
import type { WorkKind } from "./model";
