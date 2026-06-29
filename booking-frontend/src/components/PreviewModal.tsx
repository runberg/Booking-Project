import React from 'react';

interface Props {
  subject: string;
  html: string;
  onClose: () => void;
}

export const PreviewModal: React.FC<Props> = ({ subject, html, onClose }) => (
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
          <div>
            <h3 className="text-base font-medium text-gray-900">Email Preview</h3>
            <p className="text-sm text-gray-500 mt-0.5">Subject: <span className="font-medium text-gray-700">{subject}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="text-xl leading-none">✕</span>
          </button>
        </div>
        <div className="p-4">
          <p className="text-xs text-gray-400 mb-2">Shown with sample data — actual values will be substituted when sent.</p>
          <iframe
            srcDoc={html}
            title="Email preview"
            className="w-full rounded border border-gray-200 bg-white"
            style={{ height: '500px' }}
            sandbox="allow-same-origin"
          />
        </div>
        <div className="flex justify-end p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
);
