import React, { useEffect } from 'react';

// Migrate old-format button HTML (stored from previous editor) to the simple
// {{buttonName}} placeholder text. Runs once on load; harmless on new templates.
function collapseButtonBlocks(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const migrations: Array<[string, string]> = [
    ['{{verificationUrl}}', '{{verifyButton}}'],
    ['{{checkinUrl}}',      '{{checkinButton}}'],
    ['{{cancelUrl}}',       '{{cancelButton}}'],
  ];
  migrations.forEach(([href, placeholder]) => {
    doc.querySelectorAll(`a[href="${href}"]`).forEach((a) => {
      const wrapper = a.closest('div');
      if (wrapper) wrapper.replaceWith(doc.createTextNode(placeholder));
    });
  });
  return doc.body.innerHTML;
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
    if (editorRef.current) {
      editorRef.current.innerHTML = collapseButtonBlocks(initialValue || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // DOM is source of truth after mount — never sync from props again

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg); // NOSONAR — deprecated but no alternative for contenteditable
  };

  // Plain text insert: variables are stored as {{tag}} text, not as styled spans.
  // This avoids all cursor/deletion issues caused by inline contenteditable=false spans.
  const insertText = (text: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, text); // NOSONAR
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text); // NOSONAR
  };

  const fmtBtn = 'px-2.5 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700 select-none';
  const varBtn = 'px-2 py-0.5 text-xs border border-blue-200 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 select-none';

  return (
    <div className="rounded-md border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">

      {/* Formatting toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-200">
        <button type="button" className={`${fmtBtn} font-bold`} title="Bold" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}>B</button>
        <button type="button" className={`${fmtBtn} italic`} title="Italic" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}>I</button>
      </div>

      {/* Insert toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-400 self-center mr-1">Insert:</span>
        {variables.map(({ tag, label }) => (
          <button
            key={tag}
            type="button"
            title={`Insert ${tag}`}
            className={varBtn}
            onMouseDown={(e) => { e.preventDefault(); insertText(tag); }}
          >
            + {label}
          </button>
        ))}
        {showVerifyButton && (
          <button
            type="button"
            title="Insert verify-email button block — expands to styled button + link in sent email"
            className="px-2 py-0.5 text-xs border border-green-200 rounded bg-green-50 hover:bg-green-100 text-green-700 font-medium select-none"
            onMouseDown={(e) => { e.preventDefault(); insertText('{{verifyButton}}'); }}
          >
            + Verify Button
          </button>
        )}
        {showCheckinButton && (
          <button
            type="button"
            title="Insert check-in button block — expands to styled button + link in sent email"
            className={`${varBtn} font-medium`}
            onMouseDown={(e) => { e.preventDefault(); insertText('{{checkinButton}}'); }}
          >
            + Check-in Button
          </button>
        )}
        {showCancelButton && (
          <button
            type="button"
            title="Insert cancel-booking button block — expands to styled button + link in sent email"
            className="px-2 py-0.5 text-xs border border-red-200 rounded bg-red-50 hover:bg-red-100 text-red-700 font-medium select-none"
            onMouseDown={(e) => { e.preventDefault(); insertText('{{cancelButton}}'); }}
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
        className="min-h-[200px] p-3 text-sm outline-none bg-white"
        style={{ lineHeight: '1.7', wordBreak: 'break-word' }}
      />
    </div>
  );
};
