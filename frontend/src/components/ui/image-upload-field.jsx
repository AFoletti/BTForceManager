import React, { useRef, useEffect, useState } from 'react';
import { Button } from './button';
import { Upload, X } from 'lucide-react';

// Shared upload widget for entity images stored as bytes in the DB (forces,
// mechs, elementals). Shows a preview (pending file, else the current
// stored image), a file picker, and a remove action. Purely presentational -
// callers own the actual upload/delete API calls and pending-file state.
export default function ImageUploadField({ label = 'Image', currentImageUrl, file, onFileChange, onRemove, testId = 'image-upload' }) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const displayUrl = previewUrl || currentImageUrl;

  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex items-center gap-3">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt=""
            className="h-16 w-16 rounded object-contain border border-border/40 bg-muted/30"
            data-testid={`${testId}-preview`}
          />
        ) : (
          <div className="h-16 w-16 rounded border border-dashed border-border/40 flex items-center justify-center text-muted-foreground/50 text-[10px] uppercase">
            None
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            data-testid={`${testId}-input`}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) onFileChange(selected);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            data-testid={`${testId}-choose-btn`}
          >
            <Upload className="w-3.5 h-3.5" /> {displayUrl ? 'Replace' : 'Upload'}
          </Button>
          {displayUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              data-testid={`${testId}-remove-btn`}
            >
              <X className="w-3.5 h-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
