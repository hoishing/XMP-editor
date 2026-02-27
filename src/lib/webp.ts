const RIFF_MAGIC = new TextEncoder().encode("RIFF");
const WEBP_MAGIC = new TextEncoder().encode("WEBP");
const XMP_FOURCC = new TextEncoder().encode("XMP ");

/**
 * Read XMP XML from a WebP file buffer.
 * Returns null if no XMP chunk is found.
 */
export function readXmp(buffer: ArrayBuffer): string | null {
  const data = new Uint8Array(buffer);

  if (!isWebP(data)) return null;

  let offset = 12; // Skip RIFF header (RIFF + size + WEBP)

  while (offset < data.length - 8) {
    const fourcc = data.slice(offset, offset + 4);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const chunkSize = view.getUint32(offset + 4, true); // little-endian
    const chunkDataStart = offset + 8;

    if (matchesFourCC(fourcc, XMP_FOURCC)) {
      const xmpBytes = data.slice(chunkDataStart, chunkDataStart + chunkSize);
      return new TextDecoder("utf-8").decode(xmpBytes);
    }

    // Move to next chunk (chunks are padded to even size)
    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  return null;
}

/**
 * Write XMP XML into a WebP file buffer.
 * Replaces existing XMP chunk or appends a new one.
 * Also ensures VP8X chunk has the XMP flag set.
 */
export function writeXmp(buffer: ArrayBuffer, xmpXml: string): ArrayBuffer {
  const data = new Uint8Array(buffer);

  if (!isWebP(data)) {
    throw new Error("Not a valid WebP file");
  }

  const xmpBytes = new TextEncoder().encode(xmpXml);

  // Build new XMP chunk
  const newChunk = buildRiffChunk(XMP_FOURCC, xmpBytes);

  // Find existing XMP chunk range and VP8X chunk
  let existingStart: number | null = null;
  let existingEnd: number | null = null;
  let vp8xOffset: number | null = null;
  let offset = 12;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  while (offset < data.length - 8) {
    const fourcc = data.slice(offset, offset + 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataStart = offset + 8;
    const nextOffset = chunkDataStart + chunkSize + (chunkSize % 2);

    if (matchesFourCC(fourcc, XMP_FOURCC)) {
      existingStart = offset;
      existingEnd = nextOffset;
    }

    if (matchesFourCC(fourcc, new TextEncoder().encode("VP8X"))) {
      vp8xOffset = offset;
    }

    offset = nextOffset;
  }

  let result: Uint8Array;

  if (existingStart !== null && existingEnd !== null) {
    // Replace existing XMP chunk
    const before = data.slice(0, existingStart);
    const after = data.slice(existingEnd);
    result = new Uint8Array(before.length + newChunk.length + after.length);
    result.set(before, 0);
    result.set(newChunk, before.length);
    result.set(after, before.length + newChunk.length);
  } else {
    // Need to handle the case where there's no VP8X chunk
    // Simple WebP files (VP8 or VP8L only) need a VP8X chunk to support XMP
    if (vp8xOffset === null) {
      result = insertVP8XAndXmp(data, newChunk);
    } else {
      // Append XMP chunk at the end
      result = new Uint8Array(data.length + newChunk.length);
      result.set(data, 0);
      result.set(newChunk, data.length);
    }
  }

  // Update RIFF file size (bytes 4-7, little-endian, = total file size - 8)
  const resultView = new DataView(result.buffer);
  resultView.setUint32(4, result.length - 8, true);

  // Set XMP flag in VP8X chunk if present
  setVP8XFlag(result);

  return result.buffer as ArrayBuffer;
}

function insertVP8XAndXmp(
  data: Uint8Array,
  xmpChunk: Uint8Array
): Uint8Array {
  // We need to figure out image dimensions from the existing VP8/VP8L chunk
  // and create a VP8X chunk. For simplicity, read dimensions from the first chunk.
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const firstFourcc = String.fromCharCode(...data.slice(12, 16));
  let width = 0;
  let height = 0;

  if (firstFourcc === "VP8 ") {
    // Lossy: dimensions at bytes 26-29 (frame header)
    // VP8 bitstream: after chunk header(8), frame tag(3 bytes), then sync code(3 bytes)
    // then 16-bit width and 16-bit height (little-endian)
    const frameStart = 20; // 12 (RIFF header) + 8 (chunk header)
    if (data.length > frameStart + 10) {
      width = (view.getUint16(frameStart + 6, true) & 0x3fff);
      height = (view.getUint16(frameStart + 8, true) & 0x3fff);
    }
  } else if (firstFourcc === "VP8L") {
    // Lossless: signature byte (0x2f), then 32-bit value encoding width/height
    const sigStart = 20 + 1; // 12 + 8 + 1 (skip 0x2f signature)
    if (data.length > sigStart + 4) {
      const bits = view.getUint32(sigStart, true);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
    }
  }

  // Build VP8X chunk (10 bytes of data)
  const vp8xData = new Uint8Array(10);
  // Flags byte: bit 2 = XMP metadata present
  vp8xData[0] = 0x04;
  // Canvas width minus one (24 bits, little-endian)
  const w = Math.max(width - 1, 0);
  vp8xData[4] = w & 0xff;
  vp8xData[5] = (w >> 8) & 0xff;
  vp8xData[6] = (w >> 16) & 0xff;
  // Canvas height minus one (24 bits, little-endian)
  const h = Math.max(height - 1, 0);
  vp8xData[7] = h & 0xff;
  vp8xData[8] = (h >> 8) & 0xff;
  vp8xData[9] = (h >> 16) & 0xff;

  const vp8xChunk = buildRiffChunk(new TextEncoder().encode("VP8X"), vp8xData);

  // Insert VP8X right after RIFF header, then original chunks, then XMP
  const riffHeader = data.slice(0, 12);
  const originalChunks = data.slice(12);
  const result = new Uint8Array(
    riffHeader.length + vp8xChunk.length + originalChunks.length + xmpChunk.length
  );
  let pos = 0;
  result.set(riffHeader, pos); pos += riffHeader.length;
  result.set(vp8xChunk, pos); pos += vp8xChunk.length;
  result.set(originalChunks, pos); pos += originalChunks.length;
  result.set(xmpChunk, pos);

  return result;
}

/** Set the XMP flag (bit 2) in the VP8X chunk's flags byte. */
function setVP8XFlag(data: Uint8Array): void {
  let offset = 12;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  while (offset < data.length - 8) {
    const fourcc = data.slice(offset, offset + 4);
    const chunkSize = view.getUint32(offset + 4, true);

    if (matchesFourCC(fourcc, new TextEncoder().encode("VP8X"))) {
      // Flags are at the first byte of VP8X data (offset + 8)
      data[offset + 8] |= 0x04; // Set bit 2 (XMP metadata)
      return;
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }
}

function buildRiffChunk(fourcc: Uint8Array, chunkData: Uint8Array): Uint8Array {
  const padded = chunkData.length % 2 !== 0;
  const totalSize = 8 + chunkData.length + (padded ? 1 : 0);
  const chunk = new Uint8Array(totalSize);
  const view = new DataView(chunk.buffer);

  chunk.set(fourcc, 0);
  view.setUint32(4, chunkData.length, true);
  chunk.set(chunkData, 8);
  // Padding byte is already 0

  return chunk;
}

function isWebP(data: Uint8Array): boolean {
  return (
    data.length >= 12 &&
    matchesFourCC(data.slice(0, 4), RIFF_MAGIC) &&
    matchesFourCC(data.slice(8, 12), WEBP_MAGIC)
  );
}

function matchesFourCC(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length < 4 || b.length < 4) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}
