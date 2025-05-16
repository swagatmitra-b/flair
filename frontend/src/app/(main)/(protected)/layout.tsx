'use client';

import FinalNavbar from '@/components/Navbar/FinalNavbar';
import { LocalStorageTokenGen } from '@/lib/auth/general';
import { request } from '@/lib/requests';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const Layout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    // if not logged in, redirect to login
    if (LocalStorageTokenGen.getToken() === null) {
      router.push('/login');
    }
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await request({
          method: 'GET',
          url: `${process.env.NEXT_PUBLIC_API_URL}/user/profile`,
          action: 'signin',
        });

        const data = await response.json();
        setUsername(data.data.username);
        setPhoto(data.data.metadata.profileImage);
        console.log('Profile data:', data);

        localStorage.setItem(
          'user',
          JSON.stringify({
            username: data.data.username,
            ...data.data.metadata,
          }),
        );
        localStorage.setItem('myUsername', data.data.username);
      } catch (err) {
        console.error('Request failed:', err);
      }
    };

    fetchProfile();
  }, []);

  if (username === null) {
    return <div>Loading...</div>;
  }
  return (
    <>
      <FinalNavbar username={username} photo={photo ?? ''} />

      <main>{children}</main>
    </>
  );
};
export default Layout;
