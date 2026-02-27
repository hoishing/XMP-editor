const XMP_NAMESPACE = "http://ns.adobe.com/xap/1.0/\0";
const XMP_NS_BYTES = new TextEncoder().encode(XMP_NAMESPACE);

/**
 * Read the XMP XML string from a JPEG file buffer.
 * Returns null if no XMP segment is found.
 */
export function readXmp(buffer: ArrayBuffer): string | null {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Verify JPEG SOI marker
  if (data.length < 2 || view.getUint16(0) !== 0xffd8) {
    return null;
  }

  let offset = 2;

  while (offset < data.length - 4) {
    if (data[offset] !== 0xff) break;

    const markerType = data[offset + 1];

    // SOS (Start of Scan) means we've reached image data
    if (markerType === 0xda) break;
    // Skip fill bytes
    if (markerType === 0xff) {
      offset++;
      continue;
    }
    // Standalone markers (RST, SOI, EOI) have no payload
    if (markerType === 0xd0 || markerType === 0xd9) {
      offset += 2;
      continue;
    }

    const segmentLength = view.getUint16(offset + 2);
    const segmentDataStart = offset + 4;

    // APP1 marker
    if (markerType === 0xe1 && segmentLength >= XMP_NS_BYTES.length + 2) {
      if (matchesBytes(data, segmentDataStart, XMP_NS_BYTES)) {
        const xmpStart = segmentDataStart + XMP_NS_BYTES.length;
        const xmpLength = segmentLength - 2 - XMP_NS_BYTES.length;
        const xmpBytes = data.slice(xmpStart, xmpStart + xmpLength);
        return new TextDecoder("utf-8").decode(xmpBytes);
      }
    }

    offset += 2 + segmentLength;
  }

  return null;
}

/**
 * Write an XMP XML string into a JPEG file buffer.
 * Replaces existing XMP segment or inserts a new one after SOI.
 */
export function writeXmp(buffer: ArrayBuffer, xmpXml: string): ArrayBuffer {
  const xmpBytes = new TextEncoder().encode(xmpXml);
  const nsBytes = XMP_NS_BYTES;

  // Build the new APP1 segment
  const segmentDataLength = nsBytes.length + xmpBytes.length;
  // Validate APP1 segment size constraint (length field is 2 bytes, max 65535)
  if (segmentDataLength + 2 > 65535) {
    throw new Error("XMP data is too large for a single JPEG APP1 segment");
  }
  const newSegment = new Uint8Array(4 + segmentDataLength);
  const segView = new DataView(newSegment.buffer);
  newSegment[0] = 0xff;
  newSegment[1] = 0xe1;
  segView.setUint16(2, segmentDataLength + 2); // +2 for the length field itself
  newSegment.set(nsBytes, 4);
  newSegment.set(xmpBytes, 4 + nsBytes.length);

  const oldData = new Uint8Array(buffer);
  const existing = findXmpSegmentRange(buffer);

  if (existing) {
    // Replace existing XMP segment
    const before = oldData.slice(0, existing.start);
    const after = oldData.slice(existing.end);
    const result = new Uint8Array(before.length + newSegment.length + after.length);
    result.set(before, 0);
    result.set(newSegment, before.length);
    result.set(after, before.length + newSegment.length);
    return result.buffer;
  } else {
    // Insert after SOI (offset 2)
    const before = oldData.slice(0, 2);
    const after = oldData.slice(2);
    const result = new Uint8Array(before.length + newSegment.length + after.length);
    result.set(before, 0);
    result.set(newSegment, before.length);
    result.set(after, before.length + newSegment.length);
    return result.buffer;
  }
}

/** Returns the byte range [start, end) of the XMP APP1 segment, or null. */
function findXmpSegmentRange(
  buffer: ArrayBuffer
): { start: number; end: number } | null {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);

  if (data.length < 2 || view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;

  while (offset < data.length - 4) {
    if (data[offset] !== 0xff) break;

    const markerType = data[offset + 1];
    if (markerType === 0xda) break;
    if (markerType === 0xff) {
      offset++;
      continue;
    }
    if (markerType === 0xd0 || markerType === 0xd9) {
      offset += 2;
      continue;
    }

    const segmentLength = view.getUint16(offset + 2);
    const segmentDataStart = offset + 4;

    if (markerType === 0xe1 && segmentLength >= XMP_NS_BYTES.length + 2) {
      if (matchesBytes(data, segmentDataStart, XMP_NS_BYTES)) {
        return { start: offset, end: offset + 2 + segmentLength };
      }
    }

    offset += 2 + segmentLength;
  }

  return null;
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
