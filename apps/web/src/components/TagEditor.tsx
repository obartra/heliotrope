import { type KeyboardEvent, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';

const SUGGESTED_TAGS = ['activity', 'location', 'holiday', 'weather', 'event'];

interface TagEditorProps {
  tags: string[];
  allTags: string[];
  onChange: (tags: string[]) => void;
}

export function TagEditor({ tags, allTags, onChange }: TagEditorProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const merged = useMemo(() => Array.from(new Set([...SUGGESTED_TAGS, ...allTags])), [allTags]);
  const tagSet = useMemo(() => new Set(tags), [tags]);
  const suggestions = useMemo(() => {
    const q = input.toLowerCase();
    return merged.filter((t) => !tagSet.has(t) && t.toLowerCase().includes(q));
  }, [merged, tagSet, input]);

  function addTag(tag: string) {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
    setShowSuggestions(false);
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim()) addTag(input);
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      const lastTag = tags[tags.length - 1];
      if (lastTag) removeTag(lastTag);
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 rounded-md border border-input p-1 min-h-8 items-center">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 text-xs">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="ml-0.5 text-muted-foreground hover:text-foreground leading-none"
            >
              x
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 150);
          }}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? 'Add tags...' : ''}
          aria-label="Add tag"
          className="flex-1 min-w-[60px] border-0 outline-none bg-transparent text-sm px-1 py-0.5"
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute top-full left-0 right-0 bg-popover border border-border rounded-md mt-0.5 max-h-[150px] overflow-y-auto z-10 shadow-md"
        >
          {suggestions.map((s) => (
            <li
              key={s}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(s);
              }}
              className="px-2 py-1.5 cursor-pointer text-sm hover:bg-accent"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
