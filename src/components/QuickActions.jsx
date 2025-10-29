import React from 'react';

const QuickActions = ({ simplifiedTabs = [], activeTab, onSelectTab }) => {
  const active = simplifiedTabs.find((t) => t.id === activeTab);

  return (
    <>
      <div className="flex flex-wrap gap-3 overflow-x-auto py-2 justify-center my-3">
        {simplifiedTabs
          .sort((a, b) => a.priority - b.priority)
          .map((tab) => (
            <div
              key={tab.id}
              onClick={() => onSelectTab?.(tab.id)}
              className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-3 text-white cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg border-2 text-center flex-shrink-0 min-w-[140px] ${
                activeTab === tab.id ? 'border-blue-500 shadow-blue-500/20' : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <h3 className="text-xs font-bold mb-1">{tab.name}</h3>
              {activeTab === tab.id && (
                <div className="mt-1 w-full bg-blue-500 h-1 rounded-full mx-auto"></div>
              )}
            </div>
          ))}
      </div>

      {/* {active?.description ? (
        <div className="mb-8 text-center text-gray-300 text-sm">{active.description}</div>
      ) : null} */}
    </>
  );
};

export default QuickActions;


