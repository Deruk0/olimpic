"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { roomPath } from "../../../lib/paths";
import { mediaBits, roomImageLimit, roomTextLimit, type RoomMedia, type RoomMessage, type RoomSnapshot } from "../../../lib/room-protocol";
import { startRoom } from "./room-client";
import styles from "./video-room.module.css";

const labels: Record<RoomMedia, [string, string]> = {
  audio: ["Включить микрофон", "Выключить микрофон"],
  camera: ["Включить камеру", "Выключить камеру"],
  screen: ["Показать экран", "Остановить показ"]
};
const connectionLabels = {
  waiting: "Ожидаем собеседника", new: "Устанавливаем связь", connecting: "Устанавливаем связь",
  connected: "Связь установлена", disconnected: "Связь прервалась", failed: "Не удалось соединить видео и звук", closed: "Соединение закрыто"
};
const clock = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
type Streams = Partial<Record<RoomMedia, MediaStream | null>>;

function Picture({ stream, label, active, screen = false }: { stream?: MediaStream | null; label: string; active: boolean; screen?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (video.current) video.current.srcObject = stream ?? null;
  }, [stream]);
  return <figure className={screen ? styles.screen : styles.picture}>
    <video ref={video} autoPlay playsInline muted hidden={!active || !stream} aria-label={label} />
    {(!active || !stream) && <span className={styles.placeholder}>{label}</span>}
    {active && stream && <figcaption>{label}</figcaption>}
  </figure>;
}

export function VideoRoom({ id, teacher, peerName, iceServers }: {
  id: string; teacher: boolean; peerName: string; iceServers: RTCIceServer[];
}) {
  const room = useRef<ReturnType<typeof startRoom> | null>(null);
  const [entered, setEntered] = useState(false);
  const [peer, setPeer] = useState<RoomSnapshot["peer"]>(null);
  const [connection, setConnection] = useState<keyof typeof connectionLabels>("waiting");
  const [local, setLocal] = useState<Streams>({});
  const [remote, setRemote] = useState<Streams>({});
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<Partial<Record<RoomMedia, boolean>>>({});
  const [needsSound, setNeedsSound] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => () => room.current?.stop(), []);
  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    player.srcObject = remote.audio ?? null;
    setNeedsSound(false);
    if (remote.audio) void player.play().catch(() => setNeedsSound(true));
  }, [remote.audio]);

  function enter() {
    if (!globalThis.crypto?.randomUUID) {
      setError("Откройте комнату через HTTPS или на localhost.");
      return;
    }
    room.current?.stop();
    setError("");
    setLocal({});
    setRemote({});
    setMessages([]);
    setPeer(null);
    setConnection("waiting");
    setEntered(true);
    room.current = startRoom(roomPath(id) + "/sync", teacher, iceServers, {
      peer: setPeer,
      state: setConnection,
      messages: batch => setMessages(previous => [...previous, ...batch].slice(-250)),
      local: (kind, stream) => setLocal(previous => ({ ...previous, [kind]: stream })),
      remote: (kind, stream) => setRemote(previous => ({ ...previous, [kind]: stream })),
      error: setError,
      closed: message => { setEntered(false); setError(message); }
    });
  }

  if (!entered) return <section className="panel">
    <h2>Видеокомната</h2>
    <p>{teacher ? "Ученик" : "Преподаватель"} · {peerName}</p>
    <p className="muted">Микрофон и камера выключены при входе.
      {!teacher && " Преподаватель видит, когда окно урока теряет фокус."}</p>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="controls"><button onClick={enter}>Войти в видеокомнату</button><Link href="/cabinet/schedule">К расписанию</Link></div>
  </section>;

  const peerMedia = peer?.online ? peer.media : 0;
  const remoteScreen = Boolean(peerMedia & mediaBits.screen);
  const remoteCamera = Boolean(peerMedia & mediaBits.camera);
  const attention = !peer?.online ? "Ученик не в комнате" : peer.focused === true ? "Ученик на вкладке урока" :
    peer.focused === false ? "Ученик переключил вкладку или окно" : "Статус вкладки неизвестен";

  return <div className={styles.room}>
    <section className={styles.call} id="room-call" aria-label="Видеосвязь">
      <div className={styles.topLine}>
        <span className="badge" role="status">{connectionLabels[connection]}</span>
        {teacher && <div className={styles.attention} data-focus={!peer?.online ? "waiting" : String(peer.focused)} role="status">
          <strong>{attention}</strong>
          {peer && <span>Потерь фокуса · {peer.distraction_count}</span>}
        </div>}
      </div>
      {remoteScreen && <Picture stream={remote.screen} active label={"Экран · " + peerName} screen />}
      {local.screen && <Picture stream={local.screen} active label="Вы показываете экран" screen />}
      <div className={styles.tiles}>
        <Picture stream={remote.camera} active={remoteCamera} label={peer?.online ? peerName : "Ожидаем подключения…"} />
        <Picture stream={local.camera} active={!!local.camera} label="Вы" />
      </div>
      <audio ref={audio} autoPlay />
      <div className="controls">
        {(Object.keys(labels) as RoomMedia[]).map(kind => <button key={kind} className="secondary"
          disabled={busy[kind]} onClick={async () => {
            setError("");
            setBusy(previous => ({ ...previous, [kind]: true }));
            try { await room.current?.toggle(kind); }
            finally { setBusy(previous => ({ ...previous, [kind]: false })); }
          }}>{labels[kind][local[kind] ? 1 : 0]}</button>)}
        {needsSound && Boolean(peerMedia & mediaBits.audio) && <button className="secondary" onClick={() => {
          void audio.current?.play().then(() => setNeedsSound(false)).catch(() => {});
        }}>Включить звук собеседника</button>}
        {(connection === "failed" || connection === "disconnected") && <button className="secondary" onClick={enter}>Переподключить</button>}
        <a className={styles.jump} href="#room-chat">К чату ↓</a>
        <Link className={styles.leave} href="/cabinet/schedule" onClick={() => room.current?.stop()}>Выйти из урока</Link>
      </div>
      {error && <p className="notice error" role="alert">{error}</p>}
    </section>
    <RoomChat id={id} messages={messages} peerName={peerName} send={(key, body, image) => room.current!.message(key, body, image)} />
  </div>;
}

function RoomChat({ id, messages, peerName, send }: {
  id: string; messages: RoomMessage[]; peerName: string; send: (key: string, body: string, image?: File) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const key = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (list.current && follow.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages]);

  function select(image?: File) {
    if (!image) return;
    if (image.size > roomImageLimit) { setError("Изображение должно быть до 2 МБ."); return; }
    key.current = undefined;
    setFile(image);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || (!body.trim() && !file)) return;
    setSending(true);
    setError("");
    try {
      key.current ??= crypto.randomUUID();
      await send(key.current, body.trim(), file);
      key.current = undefined;
      setBody("");
      setFile(undefined);
      if (input.current) input.current.value = "";
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось отправить сообщение.");
    } finally { setSending(false); }
  }

  return <section className={styles.chat} id="room-chat" aria-labelledby="chat-title">
    <div className="split"><h2 id="chat-title">Чат урока</h2><a className={styles.jump} href="#room-call">К звонку ↑</a></div>
    <div ref={list} className={styles.messages} role="log" aria-label="Сообщения" tabIndex={0} onScroll={event => {
      const target = event.currentTarget;
      follow.current = target.scrollHeight - target.clientHeight - target.scrollTop < 40;
    }}>
      {!messages.length && <p className="muted">Сообщений пока нет.</p>}
      {messages.map(message => <article key={message.id} data-own={message.own} className={styles.message}>
        <div><strong>{message.own ? "Вы" : peerName}</strong> <time dateTime={message.sent_at}>{clock.format(new Date(message.sent_at))}</time></div>
        {message.body && <p className="pre">{message.body}</p>}
        {message.has_image && <a href={roomPath(id) + "/image/" + message.id} target="_blank" rel="noopener noreferrer">
          <img src={roomPath(id) + "/image/" + message.id} alt="Изображение из чата" />
        </a>}
      </article>)}
    </div>
    <form className={styles.chatForm} onSubmit={submit} onPaste={event => {
      const image = Array.from(event.clipboardData.items).find(item => item.type.startsWith("image/"))?.getAsFile();
      if (image && !sending) { event.preventDefault(); select(image); }
    }}>
      <label>Сообщение<textarea rows={2} maxLength={roomTextLimit} value={body} disabled={sending} onChange={event => {
        key.current = undefined;
        setBody(event.target.value);
      }} placeholder="Напишите сообщение или вставьте скриншот" /></label>
      <label className={styles.upload}>Прикрепить изображение<input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={sending} onChange={event => { select(event.target.files?.[0]); event.target.value = ""; }} /></label>
      {file && <p className={styles.selected}>{file.name || "Изображение из буфера"} <button type="button" className="plain" disabled={sending} onClick={() => {
        key.current = undefined;
        setFile(undefined);
      }}>Убрать</button></p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      <button type="submit" disabled={sending || (!body.trim() && !file)}>{sending ? "Отправляем…" : "Отправить"}</button>
    </form>
  </section>;
}
