import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '@/middleware/auth';
import { config } from '@/config';
// import { v2 as cloudinary } from 'cloudinary';

const router = Router();

// ============================================
// CLOUDINARY CONFIGURATION (COMMENTED OUT)
// ============================================
// Configure Cloudinary
// if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
//   cloudinary.config({
//     cloud_name: config.cloudinary.cloudName,
//     api_key: config.cloudinary.apiKey,
//     api_secret: config.cloudinary.apiSecret,
//   });
// }

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'posts');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ============================================
// LOCAL STORAGE CONFIGURATION (ACTIVE)
// ============================================
// Configure multer for file uploads - save to disk
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'enhanced-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// ============================================
// CLOUDINARY STORAGE (COMMENTED OUT)
// ============================================
// Configure multer for file uploads - memory storage for Cloudinary
// const storage = multer.memoryStorage();
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
 * Upload images - save locally (Cloudinary version commented out below)
 */
router.post('/images', authenticateToken, upload.array('images', 5) as any, async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images provided',
      });
    }

    const uploadedImages = req.files.map((file: any) => ({
      url: `/uploads/posts/${file.filename}`,
      filename: file.filename,
      path: file.path,
      size: file.size,
    }));

    console.log('✅ Images saved locally:', uploadedImages.length);

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

// ============================================
// CLOUDINARY UPLOAD (COMMENTED OUT)
// ============================================
/**
 * Upload images to Cloudinary
 */
// router.post('/images', authenticateToken, upload.array('images', 5) as any, async (req, res) => {
//   try {
//     if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No images provided',
//       });
//     }

//     const uploadedImages = [];

//     for (const file of req.files) {
//       try {
//         // Upload to Cloudinary
//         const result = await new Promise((resolve, reject) => {
//           cloudinary.uploader.upload_stream(
//             {
//               resource_type: 'image',
//               folder: 'autosocial/posts',
//               transformation: [
//                 { width: 1200, height: 1200, crop: 'limit' },
//                 { quality: 'auto' },
//                 { format: 'auto' }
//               ]
//             },
//             (error, result) => {
//               if (error) reject(error);
//               else resolve(result);
//             }
//           ).end(file.buffer);
//         });

//         uploadedImages.push({
//           url: (result as any).secure_url,
//           publicId: (result as any).public_id,
//           width: (result as any).width,
//           height: (result as any).height,
//         });
//       } catch (error) {
//         console.error('Error uploading image:', error);
//         return res.status(500).json({
//           success: false,
//           message: 'Failed to upload images',
//         });
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: 'Images uploaded successfully',
//       data: {
//         images: uploadedImages,
//       },
//     });
//   } catch (error) {
//     console.error('Error in image upload:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to upload images',
//     });
//   }
// });

// ============================================
// CLOUDINARY DELETE (COMMENTED OUT)
// ============================================
/**
 * Delete image from Cloudinary
 */
// router.delete('/images/:publicId', authenticateToken, async (req, res) => {
//   try {
//     const { publicId } = req.params;

//     if (!config.cloudinary.cloudName) {
//       return res.status(500).json({
//         success: false,
//         message: 'Cloudinary not configured',
//       });
//     }

//     await cloudinary.uploader.destroy(publicId);

//     return res.status(200).json({
//       success: true,
//       message: 'Image deleted successfully',
//     });
//   } catch (error) {
//     console.error('Error deleting image:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to delete image',
//     });
//   }
// });

export default router;
