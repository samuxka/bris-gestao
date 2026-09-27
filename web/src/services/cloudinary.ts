import CryptoJS from 'crypto-js';

const CLOUD_NAME = 'dtxa1leih';
const API_KEY = '877397175965442';
const API_SECRET = 'trBeUlTPCEXvI58JS7FAUD6eJj0';

export const uploadToCloudinary = async (file: File): Promise<string | null> => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000).toString();
    const stringToSign = `timestamp=${timestamp}${API_SECRET}`;
    const signature = CryptoJS.SHA1(stringToSign).toString();

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', API_KEY);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (data.secure_url) {
      return data.secure_url;
    } else {
      console.error('Cloudinary error response:', data);
      return null;
    }
  } catch (error) {
    console.error('Cloudinary upload failed:', error);
    return null;
  }
};
