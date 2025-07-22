const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload image to Cloudinary
 * @param {string} filePath - Local file path
 * @param {string} folder - Cloudinary folder name
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} Upload result
 */
const uploadImage = async (filePath, folder = 'artist-marketplace', options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'auto',
      quality: 'auto',
      fetch_format: 'auto',
      ...options
    });
    
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes
    };
  } catch (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Upload multiple images to Cloudinary
 * @param {Array} files - Array of file objects
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<Array>} Array of upload results
 */
const uploadMultipleImages = async (files, folder = 'artist-marketplace') => {
  try {
    const uploadPromises = files.map(file => 
      uploadImage(file.path, folder, {
        public_id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })
    );
    
    return await Promise.all(uploadPromises);
  } catch (error) {
    throw new Error(`Multiple image upload failed: ${error.message}`);
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Delete result
 */
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    throw new Error(`Image deletion failed: ${error.message}`);
  }
};

/**
 * Delete multiple images from Cloudinary
 * @param {Array} publicIds - Array of Cloudinary public IDs
 * @returns {Promise<Object>} Delete result
 */
const deleteMultipleImages = async (publicIds) => {
  try {
    const result = await cloudinary.api.delete_resources(publicIds);
    return result;
  } catch (error) {
    throw new Error(`Multiple image deletion failed: ${error.message}`);
  }
};

/**
 * Generate image transformations for different sizes
 * @param {string} publicId - Cloudinary public ID
 * @returns {Object} Object with different image sizes
 */
const generateImageVariants = (publicId) => {
  const baseUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;
  
  return {
    thumbnail: `${baseUrl}/w_150,h_150,c_fill,f_auto,q_auto/${publicId}`,
    small: `${baseUrl}/w_300,h_300,c_fit,f_auto,q_auto/${publicId}`,
    medium: `${baseUrl}/w_600,h_600,c_fit,f_auto,q_auto/${publicId}`,
    large: `${baseUrl}/w_1200,h_1200,c_fit,f_auto,q_auto/${publicId}`,
    original: `${baseUrl}/f_auto,q_auto/${publicId}`
  };
};

/**
 * Add watermark to image
 * @param {string} publicId - Cloudinary public ID
 * @param {string} watermarkText - Watermark text
 * @returns {string} Watermarked image URL
 */
const addWatermark = (publicId, watermarkText = 'Artist Marketplace') => {
  const baseUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;
  return `${baseUrl}/l_text:arial_20:${encodeURIComponent(watermarkText)},o_30,g_south_east,x_10,y_10/${publicId}`;
};

module.exports = {
  cloudinary,
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  deleteMultipleImages,
  generateImageVariants,
  addWatermark
};
