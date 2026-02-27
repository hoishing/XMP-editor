const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const XMP_KEYWORD = "XML:com.adobe.xmp";

/**
 * Read XMP XML from a PNG file buffer.
 * Returns null if no XMP iTXt chunk is found.
 */
export function readXmp(buffer: ArrayBuffer): string | null {
  const data = new Uint8Array(buffer);

  if (!matchesBytes(data, 0, PNG_SIGNATURE)) return null;

  let offset = 8; // Skip signature

  while (offset < data.length - 8) {
    const chunk = readChunkHeader(data, offset);
    if (!chunk) break;

    if (chunk.type === "iTXt") {
      const xmp = parseITXtForXmp(data, chunk.dataOffset, chunk.dataLength);
      if (xmp !== null) return xmp;
    }

    // Move to next chunk: length(4) + type(4) + data + CRC(4)
    offset = chunk.dataOffset + chunk.dataLength + 4;

    if (chunk.type === "IEND") break;
  }

  return null;
}

/**
 * Write XMP XML into a PNG file buffer.
 * Replaces existing XMP iTXt chunk or inserts one before the first IDAT.
 */
export function writeXmp(buffer: ArrayBuffer, xmpXml: string): ArrayBuffer {
  const data = new Uint8Array(buffer);

  if (!matchesBytes(data, 0, PNG_SIGNATURE)) {
    throw new Error("Not a valid PNG file");
  }

  const newChunkData = buildITXtData(xmpXml);
  const newChunk = buildPngChunk("iTXt", newChunkData);

  // Find existing XMP chunk and first IDAT position
  let existingStart: number | null = null;
  let existingEnd: number | null = null;
  let firstIdatOffset: number | null = null;
  let offset = 8;

  while (offset < data.length - 8) {
    const chunk = readChunkHeader(data, offset);
    if (!chunk) break;

    if (chunk.type === "iTXt" && existingStart === null) {
      const xmp = parseITXtForXmp(data, chunk.dataOffset, chunk.dataLength);
      if (xmp !== null) {
        existingStart = offset;
        existingEnd = chunk.dataOffset + chunk.dataLength + 4;
      }
    }

    if (chunk.type === "IDAT" && firstIdatOffset === null) {
      firstIdatOffset = offset;
    }

    offset = chunk.dataOffset + chunk.dataLength + 4;
    if (chunk.type === "IEND") break;
  }

  if (existingStart !== null && existingEnd !== null) {
    // Replace existing chunk
    const before = data.slice(0, existingStart);
    const after = data.slice(existingEnd);
    const result = new Uint8Array(before.length + newChunk.length + after.length);
    result.set(before, 0);
    result.set(newChunk, before.length);
    result.set(after, before.length + newChunk.length);
    return result.buffer;
  } else {
    // Insert before first IDAT (or before IEND if no IDAT found)
    const insertAt = firstIdatOffset ?? offset;
    const before = data.slice(0, insertAt);
    const after = data.slice(insertAt);
    const result = new Uint8Array(before.length + newChunk.length + after.length);
    result.set(before, 0);
    result.set(newChunk, before.length);
    result.set(after, before.length + newChunk.length);
    return result.buffer;
  }
}

interface ChunkHeader {
  type: string;
  dataOffset: number;
  dataLength: number;
}

function readChunkHeader(data: Uint8Array, offset: number): ChunkHeader | null {
  if (offset + 8 > data.length) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const dataLength = view.getUint32(offset);
  const typeBytes = data.slice(offset + 4, offset + 8);
  const type = String.fromCharCode(...typeBytes);
  const dataOffset = offset + 8;

  return { type, dataOffset, dataLength };
}

/** Parse an iTXt chunk to see if it's XMP, and if so return the XML. */
function parseITXtForXmp(
  data: Uint8Array,
  dataOffset: number,
  dataLength: number
): string | null {
  const chunkData = data.slice(dataOffset, dataOffset + dataLength);

  // iTXt structure: keyword\0 compressionFlag(1) compressionMethod(1)
  //                 languageTag\0 translatedKeyword\0 text...
  const nullIdx = chunkData.indexOf(0);
  if (nullIdx < 0) return null;

  const keyword = new TextDecoder("latin1").decode(chunkData.slice(0, nullIdx));
  if (keyword !== XMP_KEYWORD) return null;

  // Skip: null(1) + compressionFlag(1) + compressionMethod(1)
  let pos = nullIdx + 3;

  // Skip language tag (null-terminated)
  const langEnd = chunkData.indexOf(0, pos);
  if (langEnd < 0) return null;
  pos = langEnd + 1;

  // Skip translated keyword (null-terminated)
  const transEnd = chunkData.indexOf(0, pos);
  if (transEnd < 0) return null;
  pos = transEnd + 1;

  // Rest is the XMP XML
  return new TextDecoder("utf-8").decode(chunkData.slice(pos));
}

/** Build the data portion of an iTXt chunk for XMP. */
function buildITXtData(xmpXml: string): Uint8Array {
  const keywordBytes = new TextEncoder().encode(XMP_KEYWORD);
  const xmpBytes = new TextEncoder().encode(xmpXml);

  // keyword + \0 + compressionFlag(0) + compressionMethod(0)
  // + languageTag("") + \0 + translatedKeyword("") + \0 + xmpData
  const total =
    keywordBytes.length + 1 + 1 + 1 + 1 + 1 + xmpBytes.length;
  const result = new Uint8Array(total);
  let pos = 0;

  result.set(keywordBytes, pos);
  pos += keywordBytes.length;
  result[pos++] = 0; // null separator after keyword
  result[pos++] = 0; // compression flag: uncompressed
  result[pos++] = 0; // compression method
  result[pos++] = 0; // language tag: empty, null-terminated
  result[pos++] = 0; // translated keyword: empty, null-terminated
  result.set(xmpBytes, pos);

  return result;
}

/** Build a complete PNG chunk with CRC. */
function buildPngChunk(type: string, chunkData: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  // length(4) + type(4) + data + CRC(4)
  const chunk = new Uint8Array(12 + chunkData.length);
  const view = new DataView(chunk.buffer);

  view.setUint32(0, chunkData.length);
  chunk.set(typeBytes, 4);
  chunk.set(chunkData, 8);

  // CRC is calculated over type + data
  const crcInput = new Uint8Array(4 + chunkData.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(chunkData, 4);
  const crc = crc32(crcInput);
  view.setUint32(8 + chunkData.length, crc);

  return chunk;
}

// CRC-32 lookup table
const crcTable = makeCrcTable();

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  return table;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function matchesBytes(
  data: Uint8Array,
  offset: number,
  pattern: Uint8Array
): boolean {
  if (offset + pattern.length > data.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (data[offset + i] !== pattern[i]) return false;
  }
  return true;
}
