import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center px-6">
        <p className="text-6xl font-bold text-slate-200">404</p>
        <h1 className="text-xl font-semibold text-slate-800 mt-4">Page Not Found</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or you may not have access to it.
        </p>
        <Link
          href="/"
          className="inline-block mt-6 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
