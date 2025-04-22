const About: React.FC = () => {
  return (
    <div className="flex flex-col gap-8">
      <div className="bg-[#161b22] p-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">About me</h3>
          <button className="text-sm text-gray-400">✏️</button>
        </div>
        <p className="text-gray-300 mt-2 text-sm">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Et, interdum enim orci sociis
          aliquet. Scelerisque nulla integer egestas arcu. Vitae nisi magna imperdiet sed. Sit
          metus, gravida a vel, purus. Eget ligula cursus facilisi neque sed.
        </p>
      </div>

      {/* Attendance Chart (Static) */}
      {/* <div className="bg-[#161b22] p-4">
        <h3 className="text-lg font-semibold mb-2">Attended 30% of sessions and events in 2021</h3>
        <div className="grid grid-cols-12 gap-2 text-xs text-gray-400">
          {'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ').map(month => (
            <div key={month} className="text-center">
              {month}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-52 gap-1 mt-2">
          {[...Array(52)].map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-sm ${i % 10 === 0 ? 'bg-green-500' : 'bg-gray-700'}`}
              title="Session"
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Hover to see the event or session</p>
      </div> */}

      {/* Pinned Projects */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#161b22] p-4">
          <h4 className="text-md text-blue-400 font-semibold">📁 Model 1</h4>
          <p className="text-gray-400 text-sm">Project Description</p>
          <div className="mt-2 flex justify-between text-sm text-gray-400">
            <span>Last updated: 1 day ago</span>
            <span>⭐ 10</span>
          </div>
        </div>
        <div className="bg-[#161b22] p-4">
          <h4 className="text-md text-blue-400 font-semibold">📁 Model 2</h4>
          <p className="text-gray-400 text-sm">Project Description</p>
          <div className="mt-2 flex justify-between text-sm text-gray-400">
            <span>Last updated: 2 days ago</span>
            <span>⭐ 5</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default About
