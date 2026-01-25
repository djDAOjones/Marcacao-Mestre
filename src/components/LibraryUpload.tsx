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
        <p className="text-gray-400 mb-8">
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
              ? 'border-gray-600 bg-gray-800/50' 
              : isDragging
                ? 'border-blue-400 bg-blue-900/30 scale-105'
                : 'border-gray-600 hover:border-blue-500 hover:bg-gray-800/30'}
          `}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <span className="text-gray-400">Loading library...</span>
            </>
          ) : isDragging ? (
            <>
              <Upload className="w-12 h-12 text-blue-400 mb-4" />
              <span className="text-blue-300 font-medium">
                Drop to load library
              </span>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-gray-500 mb-4" />
              <span className="text-gray-300 font-medium">
                Click or drag to upload library.zip
              </span>
              <span className="text-gray-500 text-sm mt-2">
                Contains MP3s, MIDI beat maps, and manifest.json
              </span>
            </>
          )}
        </label>

        {error && (
          <div className="flex items-center gap-2 mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
