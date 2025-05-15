const Page = async ({ params }: { params: { repo_hash: string } }) => {
  const { repo_hash } = params;
  return <section>{repo_hash}</section>;
};

export default Page;
