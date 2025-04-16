import Image from 'next/image';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';

const Dashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white px-40 pt-20">
      <div className="w-full flex gap-20 justify-center ">
        <LeftPanel />
        <RightPanel />
      </div>
    </div>
  );
};

export default Dashboard;
