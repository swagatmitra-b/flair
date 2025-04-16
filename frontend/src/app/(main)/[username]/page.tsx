import Dashboard from '../../../components/dashboard/DashBoard';

const Page = async ({ params }: { params: { username: string } }) => {
  const { username } = params;
  return <Dashboard />;
};

export default Page;
