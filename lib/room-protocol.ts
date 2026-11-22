export const roomImageLimit = 2 * 1024 * 1024;
export const roomTextLimit = 2000;
export const roomPollInterval = 800;
export const mediaBits = { audio: 1, camera: 2, screen: 4 };
export type RoomMedia = keyof typeof mediaBits;
export type RoomSignal = { kind: "offer" | "answer"; sdp: string } | { kind: "ice"; candidate: RTCIceCandidateInit };
export type RoomMessage = { seq: number; id: string; own: boolean; body: string; has_image: boolean; sent_at: string };
export type RoomSnapshot = {
  peer: { token: string; online: boolean; media: number; focused: boolean | null; distraction_count: number } | null;
  signals: { seq: number; sender_token: string; payload: RoomSignal }[];
  messages: RoomMessage[];
};
