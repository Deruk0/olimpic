import { mediaBits, roomPollInterval, type RoomMedia, type RoomMessage, type RoomSignal, type RoomSnapshot } from "../../../lib/room-protocol";

const mediaKinds = ["audio", "camera", "screen"] as const;
type FocusEvent = { seq: number; focused: boolean };
type RoomCallbacks = {
  peer: (peer: RoomSnapshot["peer"]) => void;
  messages: (messages: RoomMessage[]) => void;
  local: (kind: RoomMedia, stream: MediaStream | null) => void;
  remote: (kind: RoomMedia, stream: MediaStream | null) => void;
  state: (state: RTCPeerConnectionState | "waiting") => void;
  error: (message: string) => void;
  closed: (message: string) => void;
};

class RoomRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function startRoom(endpoint: string, teacher: boolean, iceServers: RTCIceServer[], callbacks: RoomCallbacks) {
  const token = crypto.randomUUID();
  const local: Partial<Record<RoomMedia, MediaStreamTrack>> = {};
  let stopped = false;
  let joined = false;
  let timer: ReturnType<typeof setTimeout>;
  let polling = false;
  let rerun = false;
  let peer: string | undefined;
  let connection: RTCPeerConnection | undefined;
  let signalAfter = 0;
  let chatAfter = 0;
  let transportInterrupted = false;
  let attentionSeq = 0;
  let focusQueue: FocusEvent[] = [];
  let focused = document.visibilityState === "visible" && document.hasFocus();

  async function send<T>(body: Record<string, unknown> | FormData): Promise<T> {
    const multipart = body instanceof FormData;
    if (multipart) body.set("token", token);
    const result = await fetch(endpoint, {
      method: "POST",
      headers: multipart ? undefined : { "Content-Type": "application/json" },
      body: multipart ? body : JSON.stringify({ ...body, token }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!result.ok) {
      const error = await result.json().catch(() => ({}));
      throw new RoomRequestError(error.error || "Комната временно недоступна.", result.status);
    }
    return result.json() as Promise<T>;
  }

  function closeConnection() {
    if (connection) {
      connection.onconnectionstatechange = null;
      connection.onicecandidate = null;
      connection.ontrack = null;
      connection.close();
      connection = undefined;
    }
    for (const kind of mediaKinds) callbacks.remote(kind, null);
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    closeConnection();
    for (const kind of mediaKinds) {
      local[kind]?.stop();
      delete local[kind];
    }
    window.removeEventListener("focus", updateFocus);
    window.removeEventListener("blur", updateFocus);
    window.removeEventListener("pagehide", stop);
    document.removeEventListener("visibilitychange", updateFocus);
    if (joined) void fetch(endpoint, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "leave", token }) }).catch(() => {});
  }

  async function replaceTrack(kind: RoomMedia) {
    const sender = connection?.getTransceivers()[mediaKinds.indexOf(kind)]?.sender;
    if (sender) await sender.replaceTrack(local[kind] ?? null);
  }

  // Only the teacher makes the offer. Both sides keep a lane for mic, camera and screen.
  function openConnection(target: string) {
    closeConnection();
    if (typeof RTCPeerConnection === "undefined") {
      callbacks.state("failed");
      return;
    }
    const pc = new RTCPeerConnection({ iceServers });
    connection = pc;
    callbacks.state("connecting");
    let canSendIce = false;
    const localIce: RTCIceCandidateInit[] = [];
    const remoteIce: RTCIceCandidateInit[] = [];
    let outgoing = Promise.resolve();

    function transmit(payload: RoomSignal) {
      const body = { kind: "signal", target, id: crypto.randomUUID(), payload };
      outgoing = outgoing.catch(() => {}).then(async () => {
        if (connection !== pc || stopped) return;
        try {
          await send(body);
        } catch (error) {
          if (error instanceof RoomRequestError && error.status < 500) throw error;
          if (connection === pc && !stopped) await send(body);
        }
      });
      return outgoing;
    }
    function sendIce(candidate: RTCIceCandidateInit) {
      void transmit({ kind: "ice", candidate }).catch(() => {
        if (connection === pc && !stopped) callbacks.state("failed");
      });
    }
    pc.onicecandidate = event => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      if (canSendIce) sendIce(candidate);
      else localIce.push(candidate);
    };
    pc.onconnectionstatechange = () => { if (connection === pc) callbacks.state(pc.connectionState); };
    pc.ontrack = ({ track, transceiver }) => {
      const kind = mediaKinds[pc.getTransceivers().indexOf(transceiver)];
      if (kind && connection === pc) callbacks.remote(kind, new MediaStream([track]));
    };

    async function describe(kind: "offer" | "answer") {
      if (connection !== pc) return;
      const description = kind === "offer" ? await pc.createOffer() : await pc.createAnswer();
      await pc.setLocalDescription(description);
      if (!description.sdp) throw new Error("Пустое описание WebRTC.");
      await transmit({ kind, sdp: description.sdp });
      canSendIce = true;
      for (const candidate of localIce.splice(0)) sendIce(candidate);
    }
    if (teacher) {
      for (const kind of mediaKinds) pc.addTransceiver(kind === "audio" ? "audio" : "video", { direction: "sendrecv" });
      void Promise.all(mediaKinds.map(replaceTrack)).then(() => describe("offer")).catch(() => {
        if (connection === pc && !stopped) callbacks.state("failed");
      });
    }
    return async (signal: RoomSignal) => {
      if (connection !== pc) return;
      if (signal.kind === "ice") {
        if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate);
        else remoteIce.push(signal.candidate);
        return;
      }
      await pc.setRemoteDescription({ type: signal.kind, sdp: signal.sdp });
      for (const candidate of remoteIce.splice(0)) await pc.addIceCandidate(candidate);
      if (signal.kind === "offer" && !teacher) {
        for (const transceiver of pc.getTransceivers()) transceiver.direction = "sendrecv";
        await Promise.all(mediaKinds.map(replaceTrack));
        await describe("answer");
      }
    };
  }

  let receiveSignal: ReturnType<typeof openConnection>;
  async function poll() {
    if (!joined || stopped) return;
    if (polling) { rerun = true; return; }
    polling = true;
    clearTimeout(timer);
    try {
      const batch = focusQueue.slice(0, 100);
      const media = mediaKinds.reduce((mask, kind) => mask | (local[kind] ? mediaBits[kind] : 0), 0);
      const snapshot = await send<RoomSnapshot>({ kind: "sync", media, focus: batch, signalAfter, chatAfter });
      if (stopped) return;
      if (transportInterrupted) {
        transportInterrupted = false;
        callbacks.state(connection?.connectionState ?? "waiting");
      }
      focusQueue = focusQueue.slice(batch.length);
      callbacks.peer(snapshot.peer);
      if (snapshot.messages.length) {
        chatAfter = snapshot.messages[snapshot.messages.length - 1].seq;
        callbacks.messages(snapshot.messages);
      }
      const activeToken = snapshot.peer?.online ? snapshot.peer.token : undefined;
      if (activeToken !== peer) {
        peer = activeToken;
        if (peer) receiveSignal = openConnection(peer);
        else { closeConnection(); callbacks.state("waiting"); }
      }
      for (const signal of snapshot.signals) {
        signalAfter = signal.seq;
        try { if (signal.sender_token === peer) await receiveSignal?.(signal.payload); }
        catch { if (!stopped) callbacks.state("failed"); }
      }
    } catch (error) {
      if (stopped) return;
      if (error instanceof RoomRequestError && error.status < 500) {
        stop();
        callbacks.closed(error.message);
      } else {
        transportInterrupted = true;
        callbacks.state("disconnected");
      }
    } finally {
      polling = false;
      if (!stopped) {
        const delay = rerun ? 0 : roomPollInterval;
        rerun = false;
        timer = setTimeout(() => void poll(), delay);
      }
    }
  }

  function updateFocus(event?: Event) {
    if (teacher || stopped) return;
    const next = document.visibilityState === "visible" && (event?.type === "blur" ? false : document.hasFocus());
    if (next === focused) return;
    focused = next;
    focusQueue.push({ seq: ++attentionSeq, focused });
    void poll();
  }

  async function setTrack(kind: RoomMedia, track: MediaStreamTrack | undefined) {
    if (stopped) { track?.stop(); return; }
    local[kind]?.stop();
    local[kind] = track;
    if (track) track.onended = () => {
      if (local[kind] === track) void setTrack(kind, undefined).catch(() => {});
    };
    callbacks.local(kind, track ? new MediaStream([track]) : null);
    try { await replaceTrack(kind); }
    finally { void poll(); }
  }

  async function toggle(kind: RoomMedia) {
    try {
      if (local[kind]) { await setTrack(kind, undefined); return; }
      const devices = navigator.mediaDevices;
      if (kind === "screen" && !devices?.getDisplayMedia) {
        callbacks.error("Этот браузер не поддерживает демонстрацию экрана.");
        return;
      }
      const stream = kind === "screen" ? await devices.getDisplayMedia({ video: { frameRate: { ideal: 12 } }, audio: false }) :
        await devices.getUserMedia(kind === "audio" ? { audio: { echoCancellation: true, noiseSuppression: true } } :
          { video: { width: { ideal: 960 }, height: { ideal: 540 } } });
      await setTrack(kind, stream.getTracks()[0]);
    } catch {
      if (!stopped) callbacks.error(kind === "camera" ? "Камера недоступна. Проверьте разрешение или закройте программу, которая её использует." :
        kind === "audio" ? "Микрофон недоступен. Проверьте разрешение и выбранное устройство." :
          "Демонстрация экрана не запущена. Выберите экран, окно или вкладку.");
    }
  }

  async function message(id: string, body: string, image?: File) {
    if (image) {
      const data = new FormData();
      data.set("id", id);
      data.set("body", body);
      data.set("image", image);
      await send(data);
    } else await send({ kind: "message", id, body });
    void poll();
  }

  window.addEventListener("focus", updateFocus);
  window.addEventListener("blur", updateFocus);
  window.addEventListener("pagehide", stop);
  document.addEventListener("visibilitychange", updateFocus);
  void send({ kind: "join", focused }).then(() => {
    joined = true;
    if (stopped) {
      void send({ kind: "leave" }).catch(() => {});
      return;
    }
    void poll();
  }).catch((error: unknown) => {
    if (stopped) return;
    stop();
    callbacks.closed(error instanceof RoomRequestError ? error.message : "Не удалось войти в комнату. Попробуйте снова.");
  });

  return { stop, toggle, message };
}
