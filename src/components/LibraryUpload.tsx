import { useState, useRef, useCallback } from 'react';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { loadZipLibrary } from '../lib/zipLoader';
import { saveLibrary } from '../lib/db';
import type { Library, Track } from '../types';

interface LibraryUploadProps {
  onLibraryLoaded: (library: Library, tracks: Track[]) => void;
}

export function LibraryUpload({ onLibraryLoaded }: LibraryUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDemoLibrary = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch the preloaded demo library from public folder
      const response = await fetch(`${import.meta.env.BASE_URL}Archive.zip`);
      if (!response.ok) {
        throw new Error(`Demo library not available (HTTP ${response.status})`);
      }
      const blob = await response.blob();

      // Use blob directly instead of File constructor (better iOS compat)
      const zipBlob = new Blob([blob], { type: 'application/zip' });
      const file = new File([zipBlob], 'Archive.zip', { type: 'application/zip' });
      
      const { library, tracks } = await loadZipLibrary(file);
      await saveLibrary(library, tracks);
      onLibraryLoaded(library, tracks);
    } catch (err) {
      console.error('[LibraryUpload] Demo library error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load demo library');
    } finally {
      setIsLoading(false);
    }
  }, [onLibraryLoaded]);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setError('Please upload a .zip file');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { library, tracks } = await loadZipLibrary(file);
      await saveLibrary(library, tracks);
      onLibraryLoaded(library, tracks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library');
    } finally {
      setIsLoading(false);
    }
  }, [onLibraryLoaded]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await processFile(file);
    }
  }, [processFile]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold mb-2">Marcação Mestre</h1>
        <p className="text-cap-text-sec mb-8">
          Upload a library ZIP file containing your tracks and beat maps.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          className="hidden"
          id="library-upload"
        />

        <label
          htmlFor="library-upload"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            flex flex-col items-center justify-center
            w-full h-48 border-2 border-dashed rounded-xl
            cursor-pointer transition-colors
            ${isLoading 
              ? 'border-cap-border bg-cap-surface/50' 
              : isDragging
                ? 'border-cap-yellow bg-cap-gold-vivid/10 scale-105'
                : 'border-cap-border hover:border-cap-yellow hover:bg-cap-surface/30'}
          `}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-12 h-12 text-cap-yellow animate-spin mb-4" />
              <span className="text-cap-muted">Loading library...</span>
            </>
          ) : isDragging ? (
            <>
              <Upload className="w-12 h-12 text-cap-yellow mb-4" />
              <span className="text-cap-yellow font-medium">
                Drop to load library
              </span>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-cap-disabled mb-4" />
              <span className="text-cap-text-sec font-medium">
                Click or drag to upload library.zip
              </span>
              <span className="text-cap-muted text-base mt-2">
                Contains MP3s, MIDI beat maps, and manifest.json
              </span>
            </>
          )}
        </label>

        {/* Demo Library Button */}
        <div className="mt-6">
          <button
            onClick={loadDemoLibrary}
            disabled={isLoading}
            aria-label="Load demo library with sample Capoeira tracks"
            className="px-6 py-3 bg-cap-green-vivid hover:bg-cap-green-vivid/80 disabled:bg-cap-btn-hover 
                       text-cap-paper font-bold rounded-xl transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cap-text"
          >
            Load Demo Library
          </button>
          <p className="text-cap-muted text-base mt-2">
            Try the app with preloaded sample tracks
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-cap-burgundy-vivid/30 border border-cap-red rounded-lg text-cap-text" role="alert">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="flex-shrink-0 text-cap-red" />
              <span>{error}</span>
            </div>
            <p className="text-cap-muted text-sm mt-1 ml-[26px]">
              Try reloading the page, or upload a different ZIP file.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
