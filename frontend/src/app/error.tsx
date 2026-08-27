'use client';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-lg">
      <h2 className="text-xl font-semibold text-red-900 mb-4">An error occurred</h2>
      <p className="text-red-700 mb-6">We could not complete your request. Please try again.</p>
      <button onClick={() => reset()} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
        Try again
      </button>
    </div>
  );
}
