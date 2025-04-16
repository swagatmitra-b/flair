'use client';

import { Pencil, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

const Page: React.FC<{ params: { repo_name: string } }> = ({ params }) => {
  const { repo_name } = params;

  // --- About section ---
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [aboutText, setAboutText] = useState(
    'Lorem ipsum dolor sit amet consectetur, adipisicing elit. Pariatur molestiae nam quidem, expedita commodi illum, ratione a totam perferendis necessitatibus eum, quia earum doloremque animi. Laudantium doloribus ab porro eaque!'
  );
  const [tempAboutText, setTempAboutText] = useState(aboutText);

  // --- Model URI section ---
  const [isEditingModelURI, setIsEditingModelURI] = useState(false);
  const [modelURI, setModelURI] = useState('www.example.com/model-uri');
  const [tempModelURI, setTempModelURI] = useState(modelURI);

  // --- Use Cases section ---
  const [isEditingUseCases, setIsEditingUseCases] = useState(false);
  const [useCases, setUseCases] = useState(
    'Lorem ipsum dolor sit amet consectetur, adipisicing elit. Pariatur molestiae nam quidem, expedita commodi illum, ratione a totam perferendis necessitatibus eum, quia earum doloremque animi. Laudantium doloribus ab porro eaque!'
  );
  const [tempUseCases, setTempUseCases] = useState(useCases);

  // --- Framework section ---
  // For simplicity, we'll treat this as a comma-separated text list.
  const [isEditingFramework, setIsEditingFramework] = useState(false);
  const [framework, setFramework] = useState('python, tensorflow, pytorch');
  const [tempFramework, setTempFramework] = useState(framework);

  // --- Contributors section ---
  // Again treating contributors as a comma-separated text list.
  const [isEditingContributors, setIsEditingContributors] = useState(false);
  const [contributors, setContributors] = useState(
    'Contributor1, Contributor2, Contributor3'
  );
  const [tempContributors, setTempContributors] = useState(contributors);

  // // Handlers for Save/Cancel pattern. When saving, commit the temp value to the actual value.
  const handleSave = (section: string) => {
    if (section === 'about') {
      setAboutText(tempAboutText);
      setIsEditingAbout(false);
    } else if (section === 'modelURI') {
      setModelURI(tempModelURI);
      setIsEditingModelURI(false);
    } else if (section === 'useCases') {
      setUseCases(tempUseCases);
      setIsEditingUseCases(false);
    } else if (section === 'framework') {
      setFramework(tempFramework);
      setIsEditingFramework(false);
    } else if (section === 'contributors') {
      setContributors(tempContributors);
      setIsEditingContributors(false);
    }
  };

  // const handleCancel = (section: string) => {
  //   if (section === 'about') {
  //     setTempAboutText(aboutText);
  //     setIsEditingAbout(false);
  //   } else if (section === 'modelURI') {
  //     setTempModelURI(modelURI);
  //     setIsEditingModelURI(false);
  //   } else if (section === 'useCases') {
  //     setTempUseCases(useCases);
  //     setIsEditingUseCases(false);
  //   } else if (section === 'framework') {
  //     setTempFramework(framework);
  //     setIsEditingFramework(false);
  //   } else if (section === 'contributors') {
  //     setTempContributors(contributors);
  //     setIsEditingContributors(false);
  //   }
  // };

  return (
    <section className="min-h-screen bg-[#0d1117] w-full pt-20 px-32">
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
        <div className="flex-grow"></div>
        <div className="w-76 h-full border-l border-gray-500 p-4 pl-8 flex flex-col gap-4">
          {/* About Section */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between w-full">
              <h3 className="text-lg font-semibold text-white">About</h3>
              <button
                onClick={() => setIsEditingAbout(!isEditingAbout)}
                className="hover:text-blue-400"
              >
                {}
                {isEditingAbout ? <X size={16} /> : <Pencil size={16} />}
              </button>
            </div>
            {isEditingAbout ? (
              <div className="flex flex-col gap-2">
                <textarea
                  style={{ scrollbarWidth: 'none' }}
                  placeholder="Write about the model..."
                  value={tempAboutText}
                  onChange={(e) => setTempAboutText(e.target.value)}
                  className="w-full bg-[#0d1117] text-sm text-gray-500 border border-gray-600 p-2 rounded-md focus:outline-none"
                  rows={5}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave('about')}
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-400"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{aboutText}</p>
            )}
          </div>
          <hr className="border-gray-500" />

          {/* Model URI Section */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between w-full">
              <h3 className="text-lg font-semibold text-white">Model URI</h3>
              <button
                onClick={() => setIsEditingModelURI(!isEditingModelURI)}
                className="hover:text-blue-400"
              >
                {isEditingModelURI ? <X size={16} /> : <Pencil size={16} />}
              </button>
            </div>
            {isEditingModelURI ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={tempModelURI}
                  onChange={(e) => setTempModelURI(e.target.value)}
                  className="w-full bg-[#0d1117] text-sm text-gray-300 border border-gray-600 p-2 rounded-md focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave('modelURI')}
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-400"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href={`https://${modelURI}`}
                className="text-sm text-blue-500"
                target="_blank"
                rel="noopener noreferrer"
              >
                {modelURI}
              </Link>
            )}
          </div>
          <hr className="border-gray-500" />

          {/* Use Cases Section */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between w-full">
              <h3 className="text-lg font-semibold text-white">Use Cases</h3>
              <button
                onClick={() => setIsEditingUseCases(!isEditingUseCases)}
                className="hover:text-blue-400"
              >
                {isEditingUseCases ? <X size={16} /> : <Pencil size={16} />}
              </button>
            </div>
            {isEditingUseCases ? (
              <div className="flex flex-col gap-2">
                <textarea
                  placeholder="Write about the use cases..."
                  style={{ scrollbarWidth: 'none' }}
                  value={tempUseCases}
                  onChange={(e) => setTempUseCases(e.target.value)}
                  className="w-full bg-[#0d1117] text-sm text-gray-500 border border-gray-600 p-2 rounded-md focus:outline-none"
                  rows={5}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave('useCases')}
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-400"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{useCases}</p>
            )}
          </div>
          <hr className="border-gray-500" />

          {/* Framework Section */}
          {/* <div className="flex flex-col gap-2">
            <div className="flex justify-between w-full">
              <h3 className="text-lg font-semibold text-white">Framework</h3>
              <button
                onClick={() => setIsEditingFramework(true)}
                className="hover:text-blue-400"
              >
                <Pencil size={16} />
              </button>
            </div>
            {isEditingFramework ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={tempFramework}
                  onChange={(e) => setTempFramework(e.target.value)}
                  className="w-full bg-[#0d1117] text-sm text-gray-300 border border-gray-600 p-2 rounded-md focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave('framework')}
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-400"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => handleCancel('framework')}
                    className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {framework.split(',').map((fw, index) => (
                  <span
                    key={index}
                    className="bg-gray-700 px-2 py-1 rounded text-sm text-gray-300"
                  >
                    {fw.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
          <hr className="border-gray-500" /> */}

          {/* Contributors Section */}
          {/* <div className="flex flex-col gap-2">
            <div className="flex justify-between w-full">
              <h3 className="text-lg font-semibold text-white">Contributors</h3>
              <button
                onClick={() => setIsEditingContributors(true)}
                className="hover:text-blue-400"
              >
                <Pencil size={16} />
              </button>
            </div>
            {isEditingContributors ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={tempContributors}
                  onChange={(e) => setTempContributors(e.target.value)}
                  className="w-full bg-[#0d1117] text-sm text-gray-300 border border-gray-600 p-2 rounded-md focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave('contributors')}
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-400"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => handleCancel('contributors')}
                    className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {contributors.split(',').map((contrib, index) => (
                  <span
                    key={index}
                    className="bg-gray-700 px-2 py-1 rounded text-sm text-gray-300"
                  >
                    {contrib.trim()}
                  </span>
                ))}
              </div>
            )}
          </div> 
          <hr className="border-gray-500" /> */}
        </div>
      </div>
    </section>
  );
};

export default Page;
