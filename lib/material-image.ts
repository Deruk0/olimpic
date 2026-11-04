export function materialImageType(bytes: Uint8Array) {
  const header = Buffer.from(bytes.subarray(0, 12));
  if (header.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (header.subarray(0, 3).toString("hex") === "ffd8ff") return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(header.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}
