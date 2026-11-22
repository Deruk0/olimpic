import { account } from "../../../../../lib/auth";
import { first, rows, transaction } from "../../../../../lib/db";
import { materialImageType } from "../../../../../lib/material-image";
import { roomLesson } from "../../../../../lib/room-data";
import { roomImageLimit, roomTextLimit, type RoomSnapshot, type RoomSignal } from "../../../../../lib/room-protocol";

const tokenPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const isToken = (value: unknown): value is string => typeof value === "string" && tokenPattern.test(value);
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const integer = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2147483647 ? value : 0;
const response = (error: string, status: number) => Response.json({ error }, { status });

function signal(value: unknown): RoomSignal | null {
  const data = object(value);
  if ((data.kind === "offer" || data.kind === "answer") && typeof data.sdp === "string" && data.sdp.length <= 65_000) {
    return { kind: data.kind, sdp: data.sdp };
  }
  if (data.kind === "ice") {
    const { candidate, sdpMid, sdpMLineIndex, usernameFragment } = object(data.candidate);
    if (typeof candidate === "string" && candidate.length <= 2500) return { kind: "ice", candidate: {
      candidate,
      sdpMid: typeof sdpMid === "string" ? sdpMid.slice(0, 100) : null,
      sdpMLineIndex: typeof sdpMLineIndex === "number" ? integer(sdpMLineIndex) : null,
      usernameFragment: typeof usernameFragment === "string" ? usernameFragment.slice(0, 100) : null
    } };
  }
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return response("Запрос отклонён.", 403);
  const user = await account();
  if (!user) return response("Сессия закончилась. Войдите снова.", 401);
  const id = (await params).id;
  const multipart = request.headers.get("content-type")?.startsWith("multipart/form-data");
  const size = Number(request.headers.get("content-length"));
  if (size > (multipart ? roomImageLimit + 16_384 : 150_000)) return response("Слишком большой файл или запрос.", 413);
  let data: Record<string, unknown>;
  let image: Buffer | null = null;
  let mime: string | null = null;
  if (multipart) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("image");
    if (!(file instanceof File) || file.size < 1 || file.size > roomImageLimit) return response("Размер изображения — до 2 МБ.", 400);
    image = Buffer.from(await file.arrayBuffer());
    mime = materialImageType(image);
    if (!mime) return response("Выберите PNG, JPEG, WebP или GIF.", 400);
    data = { kind: "message", token: form?.get("token"), id: form?.get("id"), body: form?.get("body") };
  } else {
    data = object(await request.json().catch(() => null));
  }
  const { token, kind } = data;
  if (!isToken(token)) return response("Некорректный запрос комнаты.", 400);

  return transaction(async connection => {
    const lesson = await roomLesson(id, user, connection);
    if (!lesson) return response("Урок недоступен.", 404);
    const now = Date.now();
    if (now < lesson.opens || now >= lesson.closes) return response("Видеокомната сейчас закрыта.", 410);
    const key = [id, user.id, token];
    if (kind === "join") {
      const old = await first<{ token: string }>("SELECT token FROM room_participants WHERE lesson_id=$1 AND account_id=$2", key.slice(0, 2), connection);
      if (old && old.token !== token) await rows("DELETE FROM room_signals WHERE lesson_id=$1 AND (sender_token=$2 OR target_token=$2)", [id, old.token], connection);
      await rows(`INSERT INTO room_participants(lesson_id,account_id,token,seen_at,focused) VALUES ($1,$2,$3,now(),$4)
        ON CONFLICT (lesson_id,account_id) DO UPDATE SET token=EXCLUDED.token,seen_at=now(),
        media=0,focused=EXCLUDED.focused,focus_seq=0
        WHERE room_participants.token<>EXCLUDED.token OR room_participants.seen_at IS NULL`,
        [...key, user.role === "student" && typeof data.focused === "boolean" ? data.focused : null], connection);
      return Response.json({ ok: true });
    }

    const seat = await first<{ focused: boolean | null; focus_seq: number; distraction_count: number }>(
      `SELECT focused,focus_seq,distraction_count FROM room_participants
       WHERE lesson_id=$1 AND account_id=$2 AND token=$3 AND seen_at IS NOT NULL`, key, connection);
    if (!seat) return response("Комната открыта в другом окне или вы вышли из урока.", 409);

    if (kind === "leave") {
      await rows("UPDATE room_participants SET seen_at=NULL,media=0 WHERE lesson_id=$1 AND account_id=$2 AND token=$3", key, connection);
      return Response.json({ ok: true });
    }
    if (kind === "signal") {
      const payload = signal(data.payload);
      const target = data.target;
      if (!payload || !isToken(target) || !isToken(data.id) ||
        (payload.kind !== "ice" && payload.kind !== (user.role === "teacher" ? "offer" : "answer"))) {
        return response("Некорректный сигнал вызова.", 400);
      }
      await rows(`INSERT INTO room_signals(id,lesson_id,sender_token,target_token,payload)
        SELECT $1,$2,$3,$4,$5 FROM room_participants
        WHERE lesson_id=$2 AND token=$4 AND account_id=$6 AND seen_at IS NOT NULL
        ON CONFLICT (id) DO NOTHING`, [data.id, id, token, target, JSON.stringify(payload), lesson.peer_id], connection);
      return Response.json({ ok: true });
    }
    if (kind === "message") {
      const body = typeof data.body === "string" ? data.body.trim() : "";
      if (!isToken(data.id) || body.length > roomTextLimit || (!body && !image)) return response("Введите сообщение или прикрепите изображение.", 400);
      await rows(`INSERT INTO room_messages(id,lesson_id,sender_id,body,image,mime) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO NOTHING`, [data.id, id, user.id, body, image, mime], connection);
      return Response.json({ ok: true });
    }
    if (kind !== "sync") return response("Некорректный запрос комнаты.", 400);

    let { focused, focus_seq, distraction_count } = seat;
    if (user.role === "student" && Array.isArray(data.focus)) {
      for (const item of data.focus.slice(0, 100)) {
        const event = object(item);
        const seq = integer(event.seq);
        if (seq <= focus_seq || typeof event.focused !== "boolean") continue;
        if (focused === true && !event.focused) distraction_count += 1;
        focused = event.focused;
        focus_seq = seq;
      }
    }
    await rows(`UPDATE room_participants SET seen_at=now(),media=$4,focused=$5,focus_seq=$6,distraction_count=$7
      WHERE lesson_id=$1 AND account_id=$2 AND token=$3`,
      [...key, Math.min(7, integer(data.media)), focused, focus_seq, distraction_count], connection);
    const peer = await first<NonNullable<RoomSnapshot["peer"]>>(
      `SELECT token,media,focused,distraction_count,COALESCE(seen_at > now()-interval '75 seconds',false) AS online
       FROM room_participants WHERE lesson_id=$1 AND account_id=$2`, [id, lesson.peer_id], connection);
    const signals = peer?.online ? await rows<RoomSnapshot["signals"][number]>(
      `SELECT seq,sender_token,payload FROM room_signals
       WHERE lesson_id=$1 AND target_token=$2 AND sender_token=$3 AND seq>$4 ORDER BY seq LIMIT 160`,
      [id, token, peer.token, integer(data.signalAfter)], connection) : [];
    const messages = await rows<RoomSnapshot["messages"][number]>(
      `SELECT * FROM (SELECT seq,id,sender_id=$2 AS own,body,image IS NOT NULL AS has_image,sent_at
       FROM room_messages WHERE lesson_id=$1 AND seq>$3 ORDER BY seq DESC LIMIT 80) recent ORDER BY seq`,
      [id, user.id, integer(data.chatAfter)], connection);
    return Response.json({ peer: peer ?? null, signals, messages } satisfies RoomSnapshot, { headers: { "Cache-Control": "no-store" } });
  });
}
