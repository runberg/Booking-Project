import React from 'react';
import { Button } from './Button';

interface EmailDraftModalProps {
  title: string;
  description: React.ReactNode;
  variablesHint: React.ReactNode;
  subject: string;
  body: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
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
  onSubjectChange,
  onBodyChange,
  onClose,
  onConfirm,
  isSubmitting,
  confirmLabel,
  confirmClassName = '',
}) => (
  <div className="fixed inset-0 z-50 overflow-y-auto">
    <div className="flex min-h-screen items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 bg-black bg-opacity-50 cursor-default"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white rounded-lg shadow-xl">
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Email subject</label>
            <input
              type="text"
              className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email body (HTML)</label>
            <textarea
              rows={8}
              className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm font-mono"
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting} className={confirmClassName}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  </div>
);
