import React from 'react';

export function TabLoadingSpinner({ message }: Readonly<{ message: string }>) {
  return (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      <p className="mt-2 text-sm text-gray-600">{message}</p>
    </div>
  );
}
