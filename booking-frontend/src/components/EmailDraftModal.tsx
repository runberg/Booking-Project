import React, { useRef } from 'react';
import { Button } from './Button';
import { RichEmailEditor } from './RichEmailEditor';

interface EmailDraftModalProps {
  title: string;
  description: React.ReactNode;
  variablesHint: React.ReactNode;
  subject: string;
  body: string;
  variables: { tag: string; label: string }[];
  showCancelButton?: boolean;
  showVerifyButton?: boolean;
  showCheckinButton?: boolean;
  onSubjectChange: (value: string) => void;
  onClose: () => void;
  onConfirm: (body: string) => void;
  isSubmitting: boolean;
  confirmLabel: string;
  confirmClassName?: string;
}

export const EmailDraftModal: React.FC<EmailDraftModalProps> = ({
  title,
  description,
  variablesHint,
  subject,
  body,
  variables,
  showCancelButton = false,
  showVerifyButton = false,
  showCheckinButton = false,
  onSubjectChange,
  onClose,
  onConfirm,
  isSubmitting,
  confirmLabel,
  confirmClassName = '',
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);

  const handleConfirm = () => {
    onConfirm(editorRef.current?.innerHTML ?? body);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <button
          type="button"
          aria-label="Close"
          className="fixed inset-0 bg-black bg-opacity-50 cursor-default"
          onClick={onClose}
        />
        <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <span className="text-xl leading-none">✕</span>
            </button>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-600">{description}</p>
            <p className="text-xs text-gray-400">{variablesHint}</p>
            <div>
              <label htmlFor="email-draft-subject" className="block text-xs font-medium text-gray-600 mb-1">Email subject</label>
              <input
                id="email-draft-subject"
                type="text"
                className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm bg-white"
                value={subject}
                onChange={(e) => onSubjectChange(e.target.value)}
              />
            </div>
            <div>
              <p className="block text-xs font-medium text-gray-600 mb-1">Email body</p>
              <RichEmailEditor
                initialValue={body}
                variables={variables}
                showCancelButton={showCancelButton}
                showVerifyButton={showVerifyButton}
                showCheckinButton={showCheckinButton}
                onMount={(el) => { editorRef.current = el; }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting} className={confirmClassName}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
