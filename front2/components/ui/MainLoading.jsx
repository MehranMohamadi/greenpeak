// components/MainLoading.jsx

export default function MainLoading() {
  return (
    <div className="p-6 space-y-6 bg-white dark:bg-[#0F0F12]">
      <div className="animate-pulse">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 bg-gray-200 dark:bg-gray-600 rounded-xl"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded-lg w-64"></div>
        </div>

        <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-lg w-96 mb-2"></div>

        <div className="flex gap-4 mb-8">
          <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg w-48"></div>
          <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg w-32"></div>
        </div>

        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 mb-8">

          {/* Score card */}
          <div className="bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30] rounded-xl shadow-lg lg:col-span-2 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded-lg"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24"></div>
            </div>

            <div className="text-center space-y-3 p-4 bg-gray-50 dark:bg-[#0F0F12] rounded-xl">
              <div className="h-16 w-16 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto"></div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-16 mx-auto"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-20 mx-auto"></div>
            </div>

            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20"></div>
              <div className="space-y-1">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-[#0F0F12] rounded-lg">
                    <div className="h-2 w-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded flex-1"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main chart */}
          <div className="bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30] rounded-xl shadow-lg lg:col-span-5 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-48"></div>

              <div className="flex gap-2">
                {[1,2,3,4,5,6,7,8].map(i => (
                  <div key={i} className="h-8 w-12 bg-gray-200 dark:bg-gray-600 rounded"></div>
                ))}
              </div>
            </div>

            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-64 mb-4"></div>
            <div className="h-80 bg-gray-100 dark:bg-gray-700 rounded-lg"></div>
          </div>

        </div>

        {/* Bottom Grid */}
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded-lg w-48"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white dark:bg-[#1F1F23] border border-gray-200 dark:border-[#2B2B30] rounded-xl shadow-lg p-6 space-y-4">

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-32"></div>
                  </div>

                  <div className="flex gap-2">
                    <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                    <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-20"></div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-12"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-12"></div>
                  </div>
                </div>

                <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg"></div>

                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-24"></div>
                </div>

              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}