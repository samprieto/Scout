import SearchForm from "@/components/SearchForm";
import RecentSearchBanner from "@/components/RecentSearchBanner";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900">Scout</h1>
          <p className="text-gray-500 mt-2">AI-powered recruiting sourcing</p>
        </div>
        <RecentSearchBanner />
        <SearchForm />
      </div>
    </main>
  );
}
