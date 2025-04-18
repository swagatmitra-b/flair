type ReadmeProps = {
  readme: string
}
const Readme: React.FC<ReadmeProps> = ({ readme }) => {
  return (
    <section className="w-full h-full p-4 bg-gray-800 rounded-lg shadow-md overflow-auto">
      <div>{readme}</div>
    </section>
  )
}

export default Readme
