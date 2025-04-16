import Link from 'next/link';
import { useState } from 'react';

const Repositories: React.FC = () => {
  const username = 'karock';
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRepos = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section className="flex flex-col gap-8 p-4 rounded-lg shadow-md">
      <div className="bg-[#161b22] p-4 rounded-xl flex justify-between items-center">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-2 py-2 text-sm w-80 outline-1 rounded-md text-gray-300 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="text"
          placeholder="Find a repository..."
        />
        <Link
          href={'/repository/new'}
          className="bg-green-500 text-gray-200 py-1 px-3 rounded-lg"
        >
          New
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        {filteredRepos.map((repo, index) => (
          <RepositoryCard
            key={index}
            username={username}
            name={repo.name}
            description={repo.description}
            updateAt={repo.updateAt}
            repoHash={repo.repoHash}
          />
        ))}
      </div>
    </section>
  );
};

export default Repositories;

const RepositoryCard: React.FC<{
  username: string;
  name: string;
  description: string;
  updateAt: string;
  repoHash: string;
}> = ({ username, name, description, updateAt, repoHash }) => {
  return (
    <div className="bg-[#161b22] p-4 px-6 rounded-xl shadow-md flex flex-col gap-2">
      <Link
        href={`/${username}/${repoHash}`}
        className="text-lg font-semibold text-blue-400"
      >
        {name}
      </Link>
      <span className="flex justify-between items-center w-full">
        <p className="text-gray-400 text-sm">{description}</p>
        <p className="text-gray-500 text-xs">Updated at: {updateAt}</p>
      </span>
    </div>
  );
};

const repositories = [
  {
    name: 'Iron Man',
    description: 'This is a description of repository 1.',
    updateAt: '2023-10-01',
    repoHash: '1234567890abcdef',
  },
  {
    name: 'Spider Man',
    description: 'This is a description of repository 2.',
    updateAt: '2023-10-02',
    repoHash: 'abcdef1234567890',
  },
  {
    name: 'Bat Man',
    description: 'This is a description of repository 3.',
    updateAt: '2023-10-03',
    repoHash: 'fedcba0987654321',
  },
  {
    name: 'Captain America',
    description: 'This is a description of repository 4.',
    updateAt: '2023-10-04',
    repoHash: '0123456789abcdef',
  },
  {
    name: 'Superman',
    description: 'This is a description of repository 5.',
    updateAt: '2023-10-05',
    repoHash: '9876543210fedcba',
  },
];
