import type { CountryCondition } from '@heliotrope/schema';
import { type KeyboardEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

interface CountryConditionEditorProps {
  value: CountryCondition;
  onChange: (updated: CountryCondition) => void;
}

export function CountryConditionEditor({ value, onChange }: CountryConditionEditorProps) {
  const [input, setInput] = useState('');

  function addCode(raw: string) {
    const code = raw.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code) && !value.codes.includes(code)) {
      onChange({ ...value, codes: [...value.codes, code] });
    }
    setInput('');
  }

  function removeCode(code: string) {
    // @ts-expect-error result may be empty, validated before save
    onChange({ ...value, codes: value.codes.filter((c) => c !== code) });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim()) addCode(input);
    }
    if (e.key === 'Backspace' && !input && value.codes.length > 0) {
      const last = value.codes[value.codes.length - 1];
      if (last) removeCode(last);
    }
  }

  return (
    <div className="space-y-2">
      <Label>Country codes (ISO 3166-1 alpha-2)</Label>
      <div className="flex flex-wrap gap-1 rounded-md border border-input p-1 min-h-8 items-center">
        {value.codes.map((code) => (
          <Badge key={code} variant="secondary" className="gap-1 text-xs">
            {code}
            <button
              type="button"
              onClick={() => removeCode(code)}
              aria-label={`Remove ${code}`}
              className="ml-0.5 text-muted-foreground hover:text-foreground leading-none"
            >
              x
            </button>
          </Badge>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (input.trim()) addCode(input);
          }}
          placeholder={value.codes.length === 0 ? 'Type code, press Enter...' : ''}
          aria-label="Country code"
          className="flex-1 min-w-[60px] border-0 outline-none bg-transparent text-sm px-1 py-0.5 uppercase"
          maxLength={2}
        />
      </div>
      {value.codes.length === 0 && (
        <p className="text-sm text-destructive">Add at least one country code.</p>
      )}
    </div>
  );
}
