'use client';

import React, { useState } from 'react';

const Page: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    usecase: '',
    frameworks: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Form Submitted:', formData);
    alert('Repository Created!');
  };

  return (
    <section className="min-h-screen bg-[#0d1117] text-gray-200 px-4 sm:px-10 py-24">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-white">
          Create a New Repository
        </h1>
        <p className="text-sm text-gray-400 mb-10">
          A repository contains all project files, including the revision
          history. Already have a project repository elsewhere?
        </p>

        <form className="space-y-8" onSubmit={handleSubmit}>
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm mb-1 text-gray-300">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-[#161b22] border border-gray-600 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
              placeholder="Repository Name"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm mb-1 text-gray-300"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleChange}
              className="w-full bg-[#161b22] border border-gray-600 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
              placeholder="Repository Description"
            ></textarea>
          </div>

          {/* Use Case */}
          <div>
            <label
              htmlFor="usecase"
              className="block text-sm mb-1 text-gray-300"
            >
              Use Case
            </label>
            <input
              type="text"
              id="usecase"
              name="usecase"
              value={formData.usecase}
              onChange={handleChange}
              className="w-full bg-[#161b22] border border-gray-600 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
              placeholder="Repository Use Case"
            />
          </div>

          {/* Frameworks */}
          <div>
            <label
              htmlFor="frameworks"
              className="block text-sm mb-1 text-gray-300"
            >
              Frameworks
            </label>
            <input
              type="text"
              id="frameworks"
              name="frameworks"
              value={formData.frameworks}
              onChange={handleChange}
              className="w-full bg-[#161b22] border border-gray-600 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
              placeholder="e.g., React, Next.js"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="mt-6 w-full sm:w-fit px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition"
          >
            Create Repository
          </button>
        </form>
      </div>
    </section>
  );
};

export default Page;
