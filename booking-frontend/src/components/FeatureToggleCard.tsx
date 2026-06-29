import React from 'react';
import { Card } from './Card';
import { Button } from './Button';

interface FeatureToggleCardProps {
  title: string;
  description: string;
  isEnabled: boolean | null;
  isToggling: boolean;
  enableLabel: string;
  disableLabel: string;
  onEnable: () => void;
  onDisable: () => void;
  children?: React.ReactNode;
}

export const FeatureToggleCard: React.FC<FeatureToggleCardProps> = ({
  title,
  description,
  isEnabled,
  isToggling,
  enableLabel,
  disableLabel,
  onEnable,
  onDisable,
  children,
}) => (
  <Card>
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <h3 className="text-base font-medium text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 pt-0.5">
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${isEnabled ? 'text-green-700' : 'text-gray-500'}`}>
          <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
          {isEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
    </div>
    {children}
    <div className="mt-5 flex gap-3">
      {isEnabled ? (
        <Button variant="secondary" onClick={onDisable} disabled={isToggling || isEnabled === null}>
          {isToggling ? 'Saving…' : disableLabel}
        </Button>
      ) : (
        <Button onClick={onEnable} disabled={isToggling || isEnabled === null}>
          {isToggling ? 'Saving…' : enableLabel}
        </Button>
      )}
    </div>
  </Card>
);
