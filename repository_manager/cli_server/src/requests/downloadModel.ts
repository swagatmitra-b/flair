import { writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const saveFolder = process.env.SAVED_BASE_MODEL_URL || './basemodel/';

// download the file and save to the base model storage folder
async function downloadAndSave(url: string, fileName: string): Promise<void> {
  if (!fileName.includes(".")) {
    throw new Error('File name does not contain its extension.');
  }
  // Download the file using fetch
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  // Convert the response into an ArrayBuffer
  const arrayBuffer = await response.arrayBuffer();
  // Create a Node.js Buffer from the ArrayBuffer
  const fileBuffer = Buffer.from(arrayBuffer);

  // check if the directory exists, if not create it
  if (!existsSync(saveFolder)) {
    mkdirSync(saveFolder)
  }
  // Write the buffer to a file with the .pkl extension
  await writeFile(path.join(saveFolder, fileName) , fileBuffer);
  console.log(`File saved as ${fileName}`);
}


// Example usage:
// Replace with the actual URL of your File-type model
const modelUrl = 'https://example.com/path/to/model';
// Output file will be saved as model.pkl in the current directory
downloadAndSave(modelUrl, 'model.pkl')
  .catch(error => console.error('Error:', error));
