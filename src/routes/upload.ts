import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '@/middleware/auth';
import { config } from '@/config';
import { cloudinary } from '@/config/cloudinary';

const router = Router();

// Configure multer for file uploads - memory storage for Cloudinary
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * Upload images to Cloudinary
 */
router.post('/images', authenticateToken, upload.array('images', 5) as any, async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images provided',
      });
    }

    // Validate Cloudinary configuration
    if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary not configured',
      });
    }

    const uploadedImages = [];

    for (const file of req.files) {
      try {
        // Upload to Cloudinary
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              resource_type: 'image',
              folder: 'autosocial/posts',
              transformation: [
                { width: 1200, height: 1200, crop: 'limit' },
                { quality: 'auto' },
                { format: 'auto' }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(file.buffer);
        });

        uploadedImages.push({
          url: (result as any).secure_url,
          publicId: (result as any).public_id,
          width: (result as any).width,
          height: (result as any).height,
        });
      } catch (error) {
        console.error('Error uploading image to Cloudinary:', error);
        // Continue with other images even if one fails
      }
    }

    if (uploadedImages.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload any images',
      });
    }

    console.log('✅ Images uploaded to Cloudinary:', uploadedImages.length);

    return res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      data: {
        images: uploadedImages,
      },
    });
  } catch (error) {
    console.error('Error in image upload:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload images',
    });
  }
});

/**
 * Delete image from Cloudinary
 */
router.delete('/images/:publicId', authenticateToken, async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary not configured',
      });
    }

    await cloudinary.uploader.destroy(publicId);

    return res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete image',
    });
  }
});

export default router;
