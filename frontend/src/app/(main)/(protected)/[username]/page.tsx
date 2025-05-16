import Dashboard from '../../../../components/dashboard/DashBoard';

interface PageProps {
  params: {
    username: string;
  };
}

const Page = async ({ params }: PageProps) => {
  const { username } = params;
  return <Dashboard username={username} />;
};

export default Page;
