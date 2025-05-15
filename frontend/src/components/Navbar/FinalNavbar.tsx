import HomeNavbar from './HomeNavbar';
import ProfileNavbar from './ProfileNavbar';

type NavbarProps = {
  username: string;
  photo: string;
};

const FinalNavbar: React.FC<NavbarProps> = ({ username, photo }) => {
  // return <ProfileNavbar />
  return <HomeNavbar />;
};

export default FinalNavbar;
