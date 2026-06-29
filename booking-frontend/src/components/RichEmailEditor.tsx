import React, { useEffect } from 'react';

// Wraps {{variable}} text in a highlighted pill — but ONLY in text content, not
// inside HTML tag attributes (e.g. href="{{cancelUrl}}" must stay intact so the
// browser renders the cancel button correctly in the contenteditable).
function decorateVariables(html: string): string {
  const pill = (name: string) =>
    `<span style="background:#dbeafe;color:#1d4ed8;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:0.85em">{{${name}}}</span>`;

  const replaceVars = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, v: string) => pill(v));

  // Walk the string via indexOf to avoid a regex-based split on HTML tags.
  const parts: string[] = [];
  let pos = 0;
  while (pos < html.length) {
    const tagStart = html.indexOf('<', pos);
    if (tagStart === -1) {
      parts.push(replaceVars(html.slice(pos)));
      break;
    }
    if (tagStart > pos) {
      parts.push(replaceVars(html.slice(pos, tagStart)));
    }
    const tagEnd = html.indexOf('>', tagStart);
    if (tagEnd === -1) {
      parts.push(replaceVars(html.slice(tagStart)));
      break;
    }
    parts.push(html.slice(tagStart, tagEnd + 1));
    pos = tagEnd + 1;
  }
  return parts.join('');
}

interface ButtonCfg {
  type: string;
  label: string;
  href: string;
  pillBg: string;
  pillColor: string;
}

const BUTTON_CONFIGS: ButtonCfg[] = [
  { type: 'verify',  label: 'Verify Email',    href: '{{verificationUrl}}', pillBg: '#dcfce7', pillColor: '#166534' },
  { type: 'checkin', label: 'Check In',         href: '{{checkinUrl}}',      pillBg: '#dbeafe', pillColor: '#1d4ed8' },
  { type: 'cancel',  label: 'Cancel Booking',   href: '{{cancelUrl}}',       pillBg: '#fee2e2', pillColor: '#991b1b' },
];

// The button placeholder in the editor is a simple pill inside a block div so
// alignment (Left / Center) works normally on the containing div.
// The zero-width space after the span gives the browser a text node to place
// the cursor in, which is required for execCommand / applyAlignment to work.
function pillSpanHtml(cfg: ButtonCfg): string {
  return (
    `<span contenteditable="false" data-email-button="${cfg.type}" ` +
    `style="background:${cfg.pillBg};color:${cfg.pillColor};padding:2px 8px;border-radius:3px;` +
    `font-family:monospace;font-size:0.85em;cursor:default">{{${cfg.label}}}</span>​`
  );
}

function placeholderHtml(cfg: ButtonCfg): string {
  return `<div style="text-align:center">${pillSpanHtml(cfg)}</div>`;
}

// When loading a saved template, contract any stored full button+URL HTML back
// to the compact pill so the editor stays clean and alignment is editable.
function contractButtons(editor: HTMLDivElement): void {
  BUTTON_CONFIGS.forEach((cfg) => {
    editor.querySelectorAll(`a[href="${cfg.href}"]`).forEach((a) => {
      const wrapper = a.closest('div');
      if (!wrapper || wrapper === editor) return;
      // Keep the wrapper div intact (preserves text-align set by admin), just
      // replace its content with the compact pill span.
      wrapper.innerHTML = pillSpanHtml(cfg);
    });
  });
}

// Walk up from `node` toward `editorRoot` looking for a button pill wrapper.
// Returns the block div that wraps the pill span, or null if not found.
function findPillWrapper(node: Node | null, editorRoot: HTMLDivElement): HTMLElement | null {
  let current = node;
  while (current && current !== editorRoot) {
    if (!(current instanceof HTMLElement)) {
      current = current.parentNode;
      continue;
    }
    if ('emailButton' in current.dataset) {
      const p = current.parentElement;
      const valid = p !== null && p !== editorRoot && p.tagName === 'DIV';
      if (valid) return p;
      return null;
    }
    if (current.querySelector('[data-email-button]')) return current;
    current = current.parentNode;
  }
  return null;
}

interface Props {
  initialValue: string;
  variables: { tag: string; label: string }[];
  showCancelButton?: boolean;
  showVerifyButton?: boolean;
  showCheckinButton?: boolean;
  onMount: (el: HTMLDivElement | null) => void;
}

export const RichEmailEditor: React.FC<Props> = ({
  initialValue,
  variables,
  showCancelButton = false,
  showVerifyButton = false,
  showCheckinButton = false,
  onMount,
}) => {
  const editorRef = React.useRef<HTMLDivElement | null>(null);

  const setRef = (el: HTMLDivElement | null) => {
    editorRef.current = el;
    onMount(el);
  };

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = decorateVariables(initialValue || '');
    contractButtons(editorRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // DOM is source of truth after mount

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg); // NOSONAR — deprecated but no alternative for contenteditable formatting
  };

  // execCommand('justifyLeft/Center') fails when the only content in the block
  // is a contenteditable=false pill span. Use findPillWrapper to detect that
  // case and set textAlign directly on the wrapper div instead.
  const applyAlignment = (textAlign: 'left' | 'center') => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = globalThis.getSelection();
    if (sel && sel.rangeCount > 0) {
      const wrapper = findPillWrapper(sel.getRangeAt(0).commonAncestorContainer, editorRef.current);
      if (wrapper) {
        wrapper.style.textAlign = textAlign;
        return;
      }
    }
    const cmd = textAlign === 'left' ? 'justifyLeft' : 'justifyCenter';
    document.execCommand(cmd, false, undefined); // NOSONAR
  };

  const insertHTML = (html: string) => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, html); // NOSONAR — deprecated but no alternative for contenteditable formatting
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text); // NOSONAR — deprecated but no alternative for contenteditable formatting
  };

  const fmtBtn = 'px-2.5 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700 select-none';

  return (
    <div className="rounded-md border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">

      {/* Formatting toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-200">
        <button type="button" className={`${fmtBtn} font-bold`} title="Bold" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}>B</button>
        <button type="button" className={`${fmtBtn} italic`} title="Italic" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}>I</button>
        <button type="button" className={fmtBtn} title="Heading 1" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'h1'); }}>H1</button>
        <button type="button" className={fmtBtn} title="Heading 2" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'h2'); }}>H2</button>
        <button type="button" className={fmtBtn} title="Align left" onMouseDown={(e) => { e.preventDefault(); applyAlignment('left'); }}>Left</button>
        <button type="button" className={fmtBtn} title="Center" onMouseDown={(e) => { e.preventDefault(); applyAlignment('center'); }}>Center</button>
        <button type="button" className={fmtBtn} title="Normal text" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'div'); }}>Normal</button>
      </div>

      {/* Insert toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-400 self-center mr-1">Insert:</span>
        {variables.map(({ tag, label }) => (
          <button
            key={tag}
            type="button"
            title={`Insert ${tag}`}
            className="px-2 py-0.5 text-xs border border-blue-200 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 select-none"
            onMouseDown={(e) => {
              e.preventDefault();
              insertHTML(
                `<span style="background:#dbeafe;color:#1d4ed8;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:0.85em">${tag}</span>`,
              );
            }}
          >
            + {label}
          </button>
        ))}
        {showCheckinButton && (
          <button
            type="button"
            title="Insert check-in button (expands to button + link in sent email)"
            className="px-2 py-0.5 text-xs border border-blue-200 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium select-none"
            onMouseDown={(e) => {
              e.preventDefault();
              insertHTML(placeholderHtml(BUTTON_CONFIGS[1]));
            }}
          >
            + Check-in Button
          </button>
        )}
        {showVerifyButton && (
          <button
            type="button"
            title="Insert verify email button (expands to button + link in sent email)"
            className="px-2 py-0.5 text-xs border border-green-200 rounded bg-green-50 hover:bg-green-100 text-green-700 font-medium select-none"
            onMouseDown={(e) => {
              e.preventDefault();
              insertHTML(placeholderHtml(BUTTON_CONFIGS[0]));
            }}
          >
            + Verify Button
          </button>
        )}
        {showCancelButton && (
          <button
            type="button"
            title="Insert cancel booking button (expands to button + link in sent email)"
            className="px-2 py-0.5 text-xs border border-red-200 rounded bg-red-50 hover:bg-red-100 text-red-700 font-medium select-none"
            onMouseDown={(e) => {
              e.preventDefault();
              insertHTML(placeholderHtml(BUTTON_CONFIGS[2]));
            }}
          >
            + Cancel Button
          </button>
        )}
      </div>

      {/* Editable area */}
      <div
        ref={setRef}
        contentEditable
        suppressContentEditableWarning
        onPaste={handlePaste}
        className="min-h-[200px] p-3 text-sm outline-none"
        style={{ lineHeight: '1.7', wordBreak: 'break-word' }}
      />
    </div>
  );
};
