'use client';
import { Bell, Menu } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import Sidebar from './Sidebar';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="h-16 fixed w-full z-[100] bg-gray-900 flex items-center px-4 gap-4">
      {isOpen && <Sidebar close={() => setIsOpen(false)}></Sidebar>}
      <Image
        className="rounded-full"
        src={'/full-logo.png'}
        width={50}
        height={50}
        alt="logo"
      ></Image>
      <input
        className="focus:outline-none border-[#A0A0A0] border-1 rounded-md px-2 py-1 ml-4"
        name="search"
        type="text"
        id="search"
        placeholder="Search"
      />
      <div className="flex-grow-1"></div>
      <div>
        <Bell />
      </div>
      <Link href="/profile">
        {''}
        <Image
          className="rounded-full h-8 w-8"
          src={'/dummy/profile.png'}
          width={50}
          height={50}
          alt="profile"
        ></Image>
      </Link>
      <button onClick={() => setIsOpen(!isOpen)}>
        {' '}
        <Menu />
      </button>
    </nav>
  );
};
export default Navbar;
