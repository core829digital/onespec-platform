import { ImportError } from "./limits";

/**
 * A small, strict XML reader for the files inside .xlsx and .docx. It reports tags and text to callbacks (nothing is built in memory),
 * decodes only the five predefined entities and numeric references, and REFUSES any DTD / entity declaration — which is where XML
 * bombs ("billion laughs") and external-entity (XXE) reads live. Namespaces are dropped: `w:t` is reported as `t`.
 */
export interface XmlHandlers {
  open?: (name: string, attrs: Record<string, string>, selfClosing: boolean) => void;
  close?: (name: string) => void;
  text?: (text: string) => void;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      // Invalid or control code points are dropped (a spreadsheet cell never legitimately holds them).
      return Number.isFinite(code) && code >= 0x20 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : code === 9 || code === 10 || code === 13 ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[body] ?? m;
  });
}

const local = (qname: string) => {
  const i = qname.indexOf(":");
  return i === -1 ? qname : qname.slice(i + 1);
};

function parseAttrs(src: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const value = decodeEntities(m[2] ?? m[3] ?? "");
    attrs[m[1]] = value;
    attrs[local(m[1])] ??= value; // "w:val" is also reachable as "val"
  }
  return attrs;
}

export function parseXml(xml: string, h: XmlHandlers): void {
  let i = 0;
  const n = xml.length;
  if (/<!DOCTYPE|<!ENTITY/i.test(xml.slice(0, Math.min(n, 4096)))) throw new ImportError("CORRUPT_FILE");
  while (i < n) {
    const lt = xml.indexOf("<", i);
    if (lt === -1) {
      if (h.text && i < n) h.text(decodeEntities(xml.slice(i)));
      return;
    }
    if (lt > i && h.text) h.text(decodeEntities(xml.slice(i, lt)));
    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      if (end === -1) throw new ImportError("CORRUPT_FILE");
      i = end + 3;
    } else if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9);
      if (end === -1) throw new ImportError("CORRUPT_FILE");
      h.text?.(xml.slice(lt + 9, end));
      i = end + 3;
    } else if (xml.startsWith("<?", lt)) {
      const end = xml.indexOf("?>", lt + 2);
      if (end === -1) throw new ImportError("CORRUPT_FILE");
      i = end + 2;
    } else if (xml.startsWith("<!", lt)) {
      // <!DOCTYPE …>, <!ENTITY …>, anything declarative: never expected in an office file.
      throw new ImportError("CORRUPT_FILE");
    } else if (xml[lt + 1] === "/") {
      const end = xml.indexOf(">", lt + 2);
      if (end === -1) throw new ImportError("CORRUPT_FILE");
      h.close?.(local(xml.slice(lt + 2, end).trim()));
      i = end + 1;
    } else {
      // A start tag. Attribute values may contain ">" inside quotes, so find the real end.
      let j = lt + 1;
      let quote = "";
      while (j < n) {
        const c = xml[j];
        if (quote) {
          if (c === quote) quote = "";
        } else if (c === '"' || c === "'") quote = c;
        else if (c === ">") break;
        j++;
      }
      if (j >= n) throw new ImportError("CORRUPT_FILE");
      let inner = xml.slice(lt + 1, j);
      const selfClosing = inner.endsWith("/");
      if (selfClosing) inner = inner.slice(0, -1);
      const sp = inner.search(/\s/);
      const name = local(sp === -1 ? inner : inner.slice(0, sp));
      const attrs = sp === -1 ? {} : parseAttrs(inner.slice(sp));
      h.open?.(name, attrs, selfClosing);
      if (selfClosing) h.close?.(name);
      i = j + 1;
    }
  }
}
