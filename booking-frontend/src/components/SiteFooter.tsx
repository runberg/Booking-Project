import React, { useEffect, useState } from 'react';
import { api } from '../services/authService';

export const SiteFooter: React.FC = () => {
  const [text, setText] = useState('');

  useEffect(() => {
    api.get('/email-templates/site-footer-text')
      .then(({ data }) => { if (data?.text) setText(data.text); })
      .catch(() => {});
  }, []);

  if (!text) return null;

  const rendered = text.replaceAll('{{year}}', String(new Date().getFullYear()));

  return (
    <footer className="w-full py-4 text-center text-xs text-gray-400">
      {rendered}
    </footer>
  );
};
