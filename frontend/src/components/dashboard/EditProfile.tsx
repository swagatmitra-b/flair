'use client';

import { request } from '@/lib/requests';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type inputProps = {
  close: (isOpen: boolean) => void;
  data: {
    name: string;
    username: string;
    bio: string;
    email: string;
    displayText: string;
    profileImage: string;
  };
};

const EditProfile: React.FC<inputProps> = ({ close, data }) => {
  const [formData, setFormData] = useState(data);
  const router = useRouter();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      const res = await request({
        method: 'PUT',
        url: `${process.env.NEXT_PUBLIC_API_URL}/user/update`,
        data: {
          username: formData.username,
          metadata: {
            name: formData.name,
            displayText: formData.displayText,
            bio: formData.bio,
            profileImage: formData.profileImage,
          },
        },
        action: 'signin',
      });

      const data = await res.json();
      console.log('Response:', data);
      close(false);
      window.location.reload();
    } catch (err) {
      console.log('Error in submiting form', err);
    }
  };

  return (
    <div className="flex flex-col gap-4 min-w-72 w-72">
      <div className="flex justify-center">
        <Image
          className="rounded-full border-4 h-60 w-60 border-gray-700"
          src="/dummy/profile.png"
          width={100}
          height={100}
          alt="Profile Picture"
        />
      </div>

      <div className="flex flex-col text-center gap-2 items-center">
        <div className="flex gap-2 flex-col leading-4 w-full px-4">
          <input
            type="text"
            name="fullName"
            value={formData.name}
            onChange={handleChange}
            placeholder="Full Name"
            className="bg-transparent text-white text-center font-semibold border-b border-gray-600 focus:outline-none"
          />
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="username"
            className="bg-transparent text-sm text-center text-gray-400 border-b border-gray-600 focus:outline-none"
          />
        </div>
        <textarea
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          placeholder="Bio"
          className="text-sm text-gray-300 bg-gray-800 w-[90%] px-2 py-1"
        />
        <div className="flex gap-2 text-sm mt-2">
          <button
            onClick={handleSubmit}
            className="px-2 py-2 bg-gray-600 text-white font-semibold rounded-lg w-32 hover:bg-gray-500 transition"
          >
            Save Changes
          </button>
          <button
            onClick={() => close(false)}
            className="px-2 py-1 bg-gray-500 text-white font-semibold rounded-lg w-24 hover:bg-gray-400 transition"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Editable Links */}
      <div className="text-sm flex flex-col gap-2 text-gray-300 space-y-2 mt-4 px-4">
        {/* <input
          type="text"
          name="website"
          value={formData.website}
          onChange={handleChange}
          placeholder="🔗 Website"
          className="bg-transparent w-full border-b border-gray-700 focus:outline-none"
        />
        <input
          type="text"
          name="twitter"
          value={formData.twitter}
          onChange={handleChange}
          placeholder="🐦 Twitter"
          className="bg-transparent w-full border-b border-gray-700 focus:outline-none"
        />
        <input
          type="text"
          name="linkedin"
          value={formData.linkedin}
          onChange={handleChange}
          placeholder="💼 LinkedIn"
          className="bg-transparent w-full border-b border-gray-700 focus:outline-none"
        />
        <input
          type="text"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="📞 Phone"
          className="bg-transparent w-full border-b border-gray-700 focus:outline-none"
        /> */}
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="✉️ Email"
          className="bg-transparent w-full border-b border-gray-700 focus:outline-none"
        />
      </div>
    </div>
  );
};

export default EditProfile;
