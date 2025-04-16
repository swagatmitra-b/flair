'use client';

import { useState } from 'react';
import About from './About';
import Repositories from './Repositories';
import Settings from './Settings';

const tabs = ['Overview', 'Repositories', 'Logs', 'Settings'];

const RightPanel: React.FC = () => {
  const [tabNo, setTabNo] = useState(1);
  return (
    <div className="flex flex-col flex-grow-1 gap-4">
      {/* Nav */}
      <div className="flex gap-8 border-b border-gray-700 pb-2">
        {tabs.map((tab, index) => (
          <button
            className={`${index + 1 === tabNo ? 'font-semibold text-[#0000FF] scale-110' : ''} min-w-10 cursor-pointer transistion-all duration-200 ease-in-out`}
            onClick={() => setTabNo(index + 1)}
            key={index}
          >
            {tab}
          </button>
        ))}
      </div>
      {tabNo === 1 && <About />}
      {tabNo === 2 && <Repositories />}
      {tabNo === 3 && <div>Logs</div>}
      {tabNo === 4 && <Settings />}
    </div>
  );
};

export default RightPanel;
