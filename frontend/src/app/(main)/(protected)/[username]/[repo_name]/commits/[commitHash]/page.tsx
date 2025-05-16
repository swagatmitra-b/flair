import ModelStats from '@/components/ModelStats';
import Readme from '@/components/Readme';
import Image from 'next/image';

type PageProps = {
  params: {
    username: string;
    repo_name: string;
    commitHash: string;
  };
};

const Page = ({ params }: PageProps) => {
  const { username, repo_name, commitHash } = params;
  console.log(commitHash);
  const commitNo = 3;
  return (
    <section className="min-h-screen bg-[#0d1117] w-full pt-20 px-40">
      <div className="flex items-center gap-4 border-b border-gray-500 pb-3 px-10">
        <Image
          className="rounded-full h-10 w-10"
          src={'/dummy/profile.png'}
          width={40}
          height={40}
          alt="creatorAvatar"
        />
        <h2 className="text-xl font-semibold text-white">{repo_name}</h2>
        <div className="flex-grow"></div>
      </div>
      <div className="flex justify-center items-start mt-8">
        <div className="flex-grow px-4 flex flex-col gap-6">
          {/* Latest Commit + Number of Commits */}
          <div className="flex gap-4 items-center py-2 px-6 rounded-lg w-full bg-gray-800 ">
            <div className="text-3xl flex gap-1 font-semibold text-gray-400">
              <span>#</span>
              <span>{commitNo}</span>
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg flex gap-2 items-center text-gray-300">
                {`commit messages goes here`}
              </h2>
              <p className="flex gap-2 items-center">
                <Image
                  className="h-4 w-4 rounded-full"
                  src={'/dummy/profile.png'}
                  width={16}
                  height={16}
                  alt="avater"
                ></Image>
                <span className="text-gray-400 text-sm">{` ${username} `}</span>
              </p>
            </div>
            <div className="flex-grow"></div>
            <div className="flex items-center">
              <h3 className="text-base text-gray-400">{`4 commits behind`}</h3>
            </div>
          </div>
          {/* Change in Accuracy goes here */}
          <div className="flex gap-10 bg-gray-800 px-8 rounded-lg  items-center">
            <div className="max-w-[49%] px-6 py-4">
              <p className="text-gray-400 text-base">
                commit description goes here like on what types of data model was trained <br />
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Dolorem, voluptas? Lorem
                ipsum dolor sit amet consectetur adipisicing elit. Perspiciatis, a iure quam beatae
                dolor soluta rem non obcaecati vero tempora?
              </p>
            </div>
            <div className="flex-grow"></div>
            <div className="flex items-start">
              <div className="mt-4 text-2xl flex gap-1 font-semibold text-gray-400">
                <span>#</span>
                <span>{commitNo - 1}</span>
              </div>
              <ModelStats accuracy={0.5} loss={0.112} />
            </div>
            <div className="flex items-start">
              <div className="mt-4 text-2xl flex gap-1 font-semibold text-gray-400">
                <span>#</span>
                <span>{commitNo}</span>
              </div>{' '}
              <ModelStats accuracy={0.76} loss={0.112} />
            </div>
          </div>
          <Readme readme="Readme content goes here" />
        </div>
      </div>
    </section>
  );
};

export default Page;
