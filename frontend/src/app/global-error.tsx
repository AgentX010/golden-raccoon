'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-red-50">
          <h2 className="text-xl font-semibold text-red-900 mb-4">A critical error occurred</h2>
          <p className="text-red-700 mb-6">The application encountered an unexpected fault.</p>
          <button onClick={() => reset()} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Restart application
          </button>
        </div>
      </body>
    </html>
  );
}
