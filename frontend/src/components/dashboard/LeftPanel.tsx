'use client';
import Image from 'next/image';
import EditProfile from './EditProfile';
import { useState } from 'react';

const data = {
  fullName: 'John Doe',
  username: 'johndoe123',
  bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  website: 'myportfolio.com',
  twitter: '@twitter_username',
  linkedin: 'my_linkedin_profile',
  phone: '+255721111936',
  email: 'johndoe@example.com',
};

const LeftPanel: React.FC = () => {
  const [isEditProfile, setIsEditProfile] = useState(false);
  if (isEditProfile) {
    return <EditProfile close={() => setIsEditProfile(false)} data={data} />;
  } else {
    return (
      <div className="flex flex-col gap-4 min-w-72 w-72">
        <div className="flex justify-center ">
          <Image
            className="rounded-full border-4 h-60 w-60 border-gray-700"
            src="/dummy/profile.png"
            width={100}
            height={100}
            alt="Profile Picture"
          />
        </div>

        <div className="flex flex-col text-center gap-2 items-center">
          <div className="flex flex-col leading-4">
            <h2 className="text-xl font-semibold">{data.fullName}</h2>
            <h6 className="text-gray-400">{data.username}</h6>
          </div>
          <p className="text-gray-300 text-sm">{data.bio}</p>
          <button
            onClick={() => setIsEditProfile(true)}
            className="px-1 mt-2 py-2 text-sm bg-gray-600 text-white font-semibold rounded-lg w-32 hover:bg-gray-500 transition"
          >
            Edit Profile
          </button>
        </div>

        {/* Links */}
        <div className="text-sm text-gray-400 space-y-2 mt-4 px-4">
          <p>{data.website}</p>
          <p>{data.twitter}</p>
          <p>{data.linkedin}</p>
          <p>{data.phone}</p>
          <p>{data.email}</p>
        </div>
      </div>
    );
  }
};

export default LeftPanel;
