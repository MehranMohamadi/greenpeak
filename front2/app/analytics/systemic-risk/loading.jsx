export default function Loading() {
  return (
    <div className="p-6 space-y-6 bg-white dark:bg-[#0F0F12]">
      <div className="animate-pulse">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 bg-gray-200 dark:bg-gray-600 rounded-xl animate-pulse"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded-lg w-64 animate-pulse"></div>
        </div>
        <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-lg w-96 mb-2 animate-pulse"></div>

        {/* Top Section: Score + Main Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {/* Score Card Loading */}
          <div className="bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30] rounded-xl shadow-lg lg:col-span-1 p-6 space-y-4">
            <div className="h-16 w-16 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto animate-pulse"></div>
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-16 mx-auto animate-pulse"></div>
          </div>
          
          {/* Main Chart Loading */}
          <div className="bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30] rounded-xl shadow-lg lg:col-span-3 p-6">
            <div className="h-80 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Bottom Section: Factor Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30] rounded-xl shadow-lg p-6 space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>
              <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-full animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
