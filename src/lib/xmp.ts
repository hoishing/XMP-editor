const DC_NS = "http://purl.org/dc/elements/1.1/";
const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

/**
 * Extract dc:description text from an XMP XML string.
 * Returns empty string if not found.
 */
export function extractDescription(xmpXml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmpXml, "text/xml");

  if (doc.querySelector("parsererror")) {
    return "";
  }

  const descElements = doc.getElementsByTagNameNS(DC_NS, "description");
  if (descElements.length === 0) return "";

  const liElements = descElements[0].getElementsByTagNameNS(RDF_NS, "li");
  if (liElements.length === 0) {
    // dc:description might have plain text content (non-standard but seen in the wild)
    return descElements[0].textContent?.trim() ?? "";
  }

  // Prefer the x-default language variant
  for (let i = 0; i < liElements.length; i++) {
    if (liElements[i].getAttribute("xml:lang") === "x-default") {
      return liElements[i].textContent ?? "";
    }
  }

  // Fall back to the first li
  return liElements[0].textContent ?? "";
}

/**
 * Build an XMP XML string with the given dc:description.
 * If existingXml is provided, modifies it in place; otherwise creates a new minimal packet.
 */
export function buildXmpXml(
  existingXml: string | null,
  newDescription: string
): string {
  if (existingXml) {
    return modifyDescription(existingXml, newDescription);
  }
  return createMinimalXmp(newDescription);
}

function createMinimalXmp(description: string): string {
  const escaped = escapeXml(description);
  return [
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    `  <rdf:RDF xmlns:rdf="${RDF_NS}">`,
    `    <rdf:Description rdf:about=""`,
    `         xmlns:dc="${DC_NS}">`,
    `      <dc:description>`,
    `        <rdf:Alt>`,
    `          <rdf:li xml:lang="x-default">${escaped}</rdf:li>`,
    `        </rdf:Alt>`,
    `      </dc:description>`,
    `    </rdf:Description>`,
    `  </rdf:RDF>`,
    `</x:xmpmeta>`,
    // Add padding so future edits can fit without resizing the segment
    " ".repeat(2048),
    '<?xpacket end="w"?>',
  ].join("\n");
}

function modifyDescription(xmpXml: string, newDescription: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmpXml, "text/xml");

  if (doc.querySelector("parsererror")) {
    return createMinimalXmp(newDescription);
  }

  const descElements = doc.getElementsByTagNameNS(DC_NS, "description");

  if (descElements.length > 0) {
    const descEl = descElements[0];
    const liElements = descEl.getElementsByTagNameNS(RDF_NS, "li");

    if (liElements.length > 0) {
      // Update the x-default li, or the first one
      let target = liElements[0];
      for (let i = 0; i < liElements.length; i++) {
        if (liElements[i].getAttribute("xml:lang") === "x-default") {
          target = liElements[i];
          break;
        }
      }
      target.textContent = newDescription;
    } else {
      // dc:description exists but no rdf:li — rebuild inner structure
      while (descEl.firstChild) descEl.removeChild(descEl.firstChild);
      const alt = doc.createElementNS(RDF_NS, "rdf:Alt");
      const li = doc.createElementNS(RDF_NS, "rdf:li");
      li.setAttribute("xml:lang", "x-default");
      li.textContent = newDescription;
      alt.appendChild(li);
      descEl.appendChild(alt);
    }
  } else {
    // No dc:description — add it to the first rdf:Description
    const rdfDescriptions = doc.getElementsByTagNameNS(RDF_NS, "Description");
    if (rdfDescriptions.length > 0) {
      const rdfDesc = rdfDescriptions[0];
      if (!rdfDesc.getAttribute("xmlns:dc")) {
        rdfDesc.setAttribute("xmlns:dc", DC_NS);
      }
      const dcDesc = doc.createElementNS(DC_NS, "dc:description");
      const alt = doc.createElementNS(RDF_NS, "rdf:Alt");
      const li = doc.createElementNS(RDF_NS, "rdf:li");
      li.setAttribute("xml:lang", "x-default");
      li.textContent = newDescription;
      alt.appendChild(li);
      dcDesc.appendChild(alt);
      rdfDesc.appendChild(dcDesc);
    } else {
      // No rdf:Description at all — create from scratch
      return createMinimalXmp(newDescription);
    }
  }

  const serializer = new XMLSerializer();
  let result = serializer.serializeToString(doc);

  // XMLSerializer strips processing instructions; re-wrap with xpacket markers
  if (!result.includes("<?xpacket begin")) {
    result =
      '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>\n' +
      result +
      "\n" +
      " ".repeat(2048) +
      '\n<?xpacket end="w"?>';
  }

  return result;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
