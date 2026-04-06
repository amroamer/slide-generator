"use client";

interface Props {
  file: { filename: string; type: string; preview?: any } | null;
  onClose: () => void;
}

export function FilePreviewModal({ file, onClose }: Props) {
  if (!file) return null;
  const preview = file.preview;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-modal">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">{file.filename}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-auto p-6" style={{ maxHeight: "calc(80vh - 72px)" }}>
          {preview?.columns && preview?.rows && (
            <div className="overflow-x-auto">
              <p className="mb-3 text-xs font-medium text-gray-500">
                Showing {preview.rows.length} of {preview.row_count} rows
              </p>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {preview.columns.map((col: string) => (
                      <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.rows.map((row: Record<string, any>, i: number) => (
                    <tr key={i} className="transition-colors hover:bg-gray-50">
                      {preview.columns.map((col: string) => (
                        <td key={col} className="px-4 py-2 text-gray-700">{String(row[col] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview?.text && (
            <div>
              <p className="mb-3 text-xs font-medium text-gray-500">{preview.char_count} characters &mdash; first 500 shown</p>
              <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-5 text-sm leading-relaxed text-gray-700">{preview.text}</pre>
            </div>
          )}
          {preview?.data_preview && (
            <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-5 text-sm text-gray-700">{preview.data_preview}</pre>
          )}
          {!preview && <p className="text-gray-500">No preview available for this file.</p>}
        </div>
      </div>
    </div>
  );
}
