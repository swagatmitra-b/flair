'use client';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';
import { useEffect, useState } from 'react';
import { request } from '@/lib/requests';

const Dashboard: React.FC<{ username: string }> = ({ username }) => {
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await request({
          method: 'GET',
          url: `${process.env.NEXT_PUBLIC_API_URL}/user/username/${username}`,
          action: 'signin',
        });
        const data = await response.json();
        console.log('Data:', data);
        const curUser = {
          name: data.data.metadata.name,
          username: data.data.username,
          bio: data.data.metadata.bio,
          email: data.data.metadata.email,
          profileImage: data.data.metadata.profileImage,
          displayText: data.data.metadata.displayText,
        };
        localStorage.setItem('curUser', JSON.stringify(curUser));
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [username]);

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
