"use client";

import { useCallback, useState } from "react";
import { uploadCSV } from "@/lib/api";

interface CSVUploadProps {
  onUploadSuccess: () => void;
}

export default function CSVUpload({ onUploadSuccess }: CSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"replace" | "append">("replace");

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsUploading(true);
      try {
        await uploadCSV(file, mode);
        onUploadSuccess();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadSuccess, mode]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">Opplastingsmodus:</span>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setMode("replace")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              mode === "replace"
                ? "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            Erstatt
          </button>
          <button
            onClick={() => setMode("append")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              mode === "append"
                ? "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            Legg til
          </button>
        </div>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
            : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
        }`}
      >
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          Dra og slipp Nordnet transaksjonshistorikk (CSV) her, eller
        </p>
        <label className="cursor-pointer inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
          {isUploading ? "Laster opp..." : "Velg fil"}
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            disabled={isUploading}
          />
        </label>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  );
}
