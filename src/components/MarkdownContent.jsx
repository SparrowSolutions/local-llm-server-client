import React from 'react';

function safeHref(value) {
  const href = value.trim();
  if (/^(https?:\/\/|mailto:)/i.test(href)) return href;
  return null;
}

function renderInline(text, keyPrefix = 'i') {
  const nodes = [];
  let remaining = String(text ?? '');
  let key = 0;

  // Markdown is intentionally rendered as React elements rather than injected as HTML.
  // This keeps model output from becoming executable browser markup.
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^\s)]+(?:\s+"[^"]*")?\)|https?:\/\/[^\s<]+| {2}\n)/;

  while (remaining) {
    const match = remaining.match(pattern);
    if (!match) {
      nodes.push(remaining);
      break;
    }

    const index = match.index ?? 0;
    if (index > 0) nodes.push(remaining.slice(0, index));
    const token = match[0];
    const k = `${keyPrefix}-${key++}`;

    if (token.startsWith('```')) {
      nodes.push(token);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={k} className="md-inline-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={k}>{renderInline(token.slice(2, -2), k)}</strong>);
    } else if (token.startsWith('~~')) {
      nodes.push(<del key={k}>{renderInline(token.slice(2, -2), k)}</del>);
    } else if (token.startsWith('*') || token.startsWith('_')) {
      nodes.push(<em key={k}>{renderInline(token.slice(1, -1), k)}</em>);
    } else if (token.startsWith('[')) {
      const matchLink = token.match(/^\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)$/);
      const href = matchLink ? safeHref(matchLink[2]) : null;
      if (matchLink && href) {
        nodes.push(<a key={k} href={href} target="_blank" rel="noreferrer noopener" title={matchLink[3] || undefined}>{matchLink[1]}</a>);
      } else {
        nodes.push(token);
      }
    } else if (/^https?:\/\//i.test(token)) {
      const href = safeHref(token.replace(/[.,!?;:]+$/, ''));
      const label = token;
      if (href) nodes.push(<a key={k} href={href} target="_blank" rel="noreferrer noopener">{label}</a>);
      else nodes.push(token);
    } else if (token === '  \n') {
      nodes.push(<br key={k} />);
    }

    remaining = remaining.slice(index + token.length);
  }
  return nodes;
}

function isTableSeparator(line) {
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
  return cells.length > 0 && cells.every(cell => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function parseList(lines, start) {
  const first = lines[start].match(/^(\s*)([-*+] |\d+[.)] )(.*)$/);
  if (!first) return null;
  const ordered = /^\d/.test(first[2]);
  const items = [];
  let i = start;

  while (i < lines.length) {
    const m = lines[i].match(/^(\s*)([-*+] |\d+[.)] )(.*)$/);
    if (!m || /^\d/.test(m[2]) !== ordered) break;
    items.push({ text: m[3], indent: m[1].length });
    i += 1;
  }

  const Tag = ordered ? 'ol' : 'ul';
  return { node: <Tag>{items.map((item, index) => <li key={index}>{renderInline(item.text, `li-${start}-${index}`)}</li>)}</Tag>, next: i };
}

export default function MarkdownContent({ content }) {
  const text = String(content ?? '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `md-${blockKey++}`;

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Fenced code blocks. This also behaves sensibly while the model is still streaming.
    const fence = line.match(/^\s*(```+|~~~+)\s*([\w+-]*)\s*$/);
    if (fence) {
      const marker = fence[1];
      const language = fence[2];
      const code = [];
      i += 1;
      while (i < lines.length && !new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`).test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        <pre className="md-code-block" key={key}>
          {language && <div className="md-code-language">{language}</div>}
          <code>{code.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      const Tag = `h${heading[1].length}`;
      blocks.push(React.createElement(Tag, { key }, renderInline(heading[2], key)));
      i += 1;
      continue;
    }

    if (/^\s*(\*\s*){3,}$|^\s*(-\s*){3,}$|^\s*(_\s*){3,}$/.test(line)) {
      blocks.push(<hr key={key} />);
      i += 1;
      continue;
    }

    if (i + 1 < lines.length && line.includes('|') && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line);
      const alignments = splitTableRow(lines[i + 1]).map(cell => {
        const left = cell.startsWith(':');
        const right = cell.endsWith(':');
        return left && right ? 'center' : right ? 'right' : left ? 'left' : undefined;
      });
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div className="md-table-wrap" key={key}>
          <table className="md-table">
            <thead><tr>{headers.map((cell, idx) => <th key={idx} style={alignments[idx] ? { textAlign: alignments[idx] } : undefined}>{renderInline(cell, `${key}-h-${idx}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, r) => <tr key={r}>{headers.map((_, c) => <td key={c} style={alignments[c] ? { textAlign: alignments[c] } : undefined}>{renderInline(row[c] || '', `${key}-${r}-${c}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      const quoteLines = [];
      while (i < lines.length) {
        const q = lines[i].match(/^\s*>\s?(.*)$/);
        if (!q) break;
        quoteLines.push(q[1]);
        i += 1;
      }
      blocks.push(<blockquote key={key}>{quoteLines.map((q, idx) => <React.Fragment key={idx}>{renderInline(q, `${key}-${idx}`)}{idx < quoteLines.length - 1 && <br />}</React.Fragment>)}</blockquote>);
      continue;
    }

    const list = parseList(lines, i);
    if (list) {
      blocks.push(React.cloneElement(list.node, { key }));
      i = list.next;
      continue;
    }

    // Paragraph: collect consecutive ordinary lines. Markdown line breaks are preserved.
    const paragraph = [line];
    i += 1;
    while (i < lines.length && lines[i].trim()) {
      if (/^\s*(```+|~~~+)/.test(lines[i]) || /^\s{0,3}#{1,6}\s+/.test(lines[i]) || /^\s*>/.test(lines[i]) || parseList(lines, i) || (i + 1 < lines.length && lines[i].includes('|') && isTableSeparator(lines[i + 1]))) break;
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key}>
        {paragraph.map((part, idx) => <React.Fragment key={idx}>{idx > 0 && <br />}{renderInline(part, `${key}-${idx}`)}</React.Fragment>)}
      </p>
    );
  }

  return <div className="markdown-content">{blocks}</div>;
}
