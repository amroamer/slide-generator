"use client";

import api from "@/lib/api";
import { useCallback, useRef, useState } from "react";

interface UploadedFile {
  filename: string;
  size: number;
  type: string;
  parse_status: string;
  preview?: any;
  error?: string;
}

interface Props {
  presentationId: string;
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  onPreview: (file: UploadedFile) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  csv: { icon: "CSV", color: "bg-blue-100 text-blue-700" },
  xlsx: { icon: "XLS", color: "bg-emerald-100 text-emerald-700" },
  xls: { icon: "XLS", color: "bg-emerald-100 text-emerald-700" },
  pdf: { icon: "PDF", color: "bg-red-100 text-red-700" },
  json: { icon: "{ }", color: "bg-purple-100 text-purple-700" },
  txt: { icon: "TXT", color: "bg-gray-100 text-gray-700" },
};

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || { icon: "FILE", color: "bg-gray-100 text-gray-600" };
}

export function FileUploadZone({ presentationId, files, onFilesChange, onPreview }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const upload = useCallback(async (fileList: FileList) => {
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(fileList).forEach((f) => formData.append("files", f));
      const { data } = await api.post(`/presentations/${presentationId}/upload`, formData);
      onFilesChange([...files, ...data]);
    } catch (err) { console.error("Upload failed", err); }
    finally { setUploading(false); }
  }, [presentationId, files, onFilesChange]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length > 0) upload(e.dataTransfer.files);
  }

  async function handleRemove(filename: string) {
    try { await api.delete(`/presentations/${presentationId}/files/${filename}`); onFilesChange(files.filter((f) => f.filename !== filename)); } catch {}
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
          dragOver
            ? "border-[#0091DA] bg-blue-50/50"
            : "border-gray-300 bg-gray-50/50 hover:border-gray-400 hover:bg-gray-50"
        }`}
      >
        <input ref={inputRef} type="file" multiple accept=".csv,.xlsx,.xls,.txt,.pdf,.json" className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#0091DA]" />
            <p className="text-sm font-medium text-gray-600">Uploading...</p>
          </div>
        ) : (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-gray-400">CSV, Excel, PDF, TXT, JSON &mdash; max 25MB per file</p>
          </>
        )}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f) => {
            const icon = getFileIcon(f.filename);
            return (
              <div key={f.filename} className="card-hover flex items-center justify-between p-3 animate-fade-in">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${icon.color}`}>
                    {icon.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{f.filename}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{formatSize(f.size)}</span>
                      {f.parse_status === "success" && (
                        <span className="flex items-center gap-0.5 text-emerald-600">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          Parsed
                        </span>
                      )}
                      {f.parse_status === "error" && <span className="text-red-500">{f.error || "Parse error"}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {f.preview && (
                    <button onClick={() => onPreview(f)} className="btn-ghost text-xs text-[#0091DA]">Preview</button>
                  )}
                  <button onClick={() => handleRemove(f.filename)} className="btn-ghost text-xs text-red-500 hover:text-red-700">Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
