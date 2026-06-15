import React from 'react';

export type TimingControlProps = Readonly<{
  id: string;
  unit: string;
  min: number;
  max: number;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  note?: string;
}>;

export function TimingControl({ id, unit, min, max, value, onChange, onSave, note }: TimingControlProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
      <label htmlFor={id} className="text-sm font-medium text-amber-900 whitespace-nowrap">Send</label>
      <input id={id} type="number" min={min} max={max} className="w-16 rounded-md border border-amber-300 py-1.5 px-2 text-sm text-center" value={value} onChange={onChange} />
      <span className="text-sm text-amber-900">{unit} before the booking</span>
      <button className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline whitespace-nowrap" onClick={onSave}>Save</button>
      {note && <p className="w-full text-xs text-amber-700 mt-1">{note}</p>}
    </div>
  );
}
