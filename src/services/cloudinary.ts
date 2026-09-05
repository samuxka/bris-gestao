import CryptoJS from 'crypto-js';
import * as FileSystem from 'expo-file-system/legacy';

const CLOUD_NAME = 'dtxa1leih';
const API_KEY = '877397175965442';
const API_SECRET = 'trBeUlTPCEXvI58JS7FAUD6eJj0';

export const uploadToCloudinary = async (imageUri: string): Promise<string | null> => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000).toString();
    const stringToSign = `timestamp=${timestamp}${API_SECRET}`;
    const signature = CryptoJS.SHA1(stringToSign).toString();

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

    const uploadTask = await FileSystem.uploadAsync(url, imageUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      parameters: {
        api_key: API_KEY,
        timestamp: timestamp,
        signature: signature,
      },
    });

    const data = JSON.parse(uploadTask.body);

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
