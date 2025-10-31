
import React, { useState } from 'react';
import { editImage } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import Loader from './Loader';

const ImageEditor: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<{ file: File; url: string } | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOriginalImage({ file, url: URL.createObjectURL(file) });
      setEditedImage(null);
      setError(null);
    }
  };

  const handleEdit = async () => {
    if (!originalImage || !prompt) {
      setError('Please upload an image and provide an editing prompt.');
      return;
    }
    setLoading(true);
    setError(null);
    setEditedImage(null);

    try {
      const base64Data = await fileToBase64(originalImage.file);
      const newImageUrl = await editImage(base64Data, originalImage.file.type, prompt);
      setEditedImage(newImageUrl);
    } catch (err) {
      setError('Failed to edit image. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-6">
      <h2 className="text-2xl font-bold mb-4 text-indigo-400">Image Editor</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="image-upload" className="block text-sm font-medium text-gray-300 mb-2">Upload Image</label>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={loading}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Add a retro filter, remove the person in the background"
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
          rows={3}
          disabled={loading || !originalImage}
        />
        <button
          onClick={handleEdit}
          disabled={loading || !originalImage || !prompt}
          className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Editing...' : 'Apply Edit'}
        </button>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>

      <div className="mt-6">
        {loading && <Loader text="Applying AI magic..." />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-center">Original</h3>
            {originalImage ? (
              <img src={originalImage.url} alt="Original" className="rounded-lg w-full shadow-lg" />
            ) : (
                <div className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">Upload an image to start</p>
                </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2 text-center">Edited</h3>
            {editedImage ? (
              <img src={editedImage} alt="Edited" className="rounded-lg w-full shadow-lg" />
            ) : (
                <div className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">Your edited image will appear here</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;
