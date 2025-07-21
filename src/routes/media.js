const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/management/media/sessions:
 *   get:
 *     tags: [Media]
 *     summary: List all sessions with media files
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Sessions with media files
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sessionId:
 *                         type: string
 *                       mediaCount:
 *                         type: number
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const downloadsDir = path.join(process.cwd(), 'downloads');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    const sessionsWithMedia = new Map();
    
    // Check downloads directory for session-based media
    try {
      const downloadFiles = await fs.readdir(downloadsDir, { withFileTypes: true });
      for (const file of downloadFiles) {
        if (file.isFile() && !file.name.startsWith('.')) {
          // Extract session info from filename (assuming format contains session info)
          const sessionMatch = file.name.match(/^([^_]+)_/);
          const sessionId = sessionMatch ? sessionMatch[1] : 'general';
          
          if (!sessionsWithMedia.has(sessionId)) {
            sessionsWithMedia.set(sessionId, { sessionId, mediaCount: 0 });
          }
          sessionsWithMedia.get(sessionId).mediaCount++;
        }
      }
    } catch (error) {
      console.warn('Downloads directory not accessible:', error.message);
    }
    
    // Check uploads directory for general media
    try {
      const uploadFiles = await fs.readdir(uploadsDir, { withFileTypes: true });
      for (const file of uploadFiles) {
        if (file.isFile() && !file.name.startsWith('.')) {
          const sessionId = 'uploads';
          if (!sessionsWithMedia.has(sessionId)) {
            sessionsWithMedia.set(sessionId, { sessionId, mediaCount: 0 });
          }
          sessionsWithMedia.get(sessionId).mediaCount++;
        }
      }
    } catch (error) {
      console.warn('Uploads directory not accessible:', error.message);
    }
    
    res.json({
      success: true,
      sessions: Array.from(sessionsWithMedia.values())
    });
  } catch (error) {
    console.error('Error listing media sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list media sessions'
    });
  }
});

/**
 * @swagger
 * /api/management/media/session/{sessionId}:
 *   get:
 *     tags: [Media]
 *     summary: List media files for a specific session
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Media files for the session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sessionId:
 *                   type: string
 *                 media:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       filename:
 *                         type: string
 *                       type:
 *                         type: string
 *                       size:
 *                         type: number
 *                       createdAt:
 *                         type: string
 *                       downloadUrl:
 *                         type: string
 *                       previewUrl:
 *                         type: string
 */
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const media = [];
    
    const getFileType = (filename) => {
      const ext = path.extname(filename).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'image';
      if (['.mp4', '.avi', '.mov', '.wmv', '.webm'].includes(ext)) return 'video';
      if (['.mp3', '.wav', '.m4a', '.ogg', '.opus'].includes(ext)) return 'audio';
      if (['.pdf'].includes(ext)) return 'pdf';
      if (['.doc', '.docx'].includes(ext)) return 'document';
      return 'other';
    };
    
    const processDirectory = async (dirPath, urlPrefix) => {
      try {
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const file of files) {
          if (file.isFile() && !file.name.startsWith('.')) {
            // For downloads, filter by sessionId prefix
            if (dirPath.includes('downloads')) {
              const sessionMatch = file.name.match(/^([^_]+)_/);
              const fileSessionId = sessionMatch ? sessionMatch[1] : 'general';
              if (fileSessionId !== sessionId && sessionId !== 'general') {
                continue;
              }
            }
            
            // For uploads, only show if sessionId is 'uploads'
            if (dirPath.includes('uploads') && sessionId !== 'uploads') {
              continue;
            }
            
            const filePath = path.join(dirPath, file.name);
            const stats = await fs.stat(filePath);
            const fileType = getFileType(file.name);
            
            media.push({
              filename: file.name,
              type: fileType,
              size: stats.size,
              createdAt: stats.birthtime.toISOString(),
              downloadUrl: `${urlPrefix}/${encodeURIComponent(file.name)}`,
              previewUrl: fileType === 'image' ? `${urlPrefix}/${encodeURIComponent(file.name)}` : null
            });
          }
        }
      } catch (error) {
        console.warn(`Directory ${dirPath} not accessible:`, error.message);
      }
    };
    
    // Process downloads directory
    const downloadsDir = path.join(process.cwd(), 'downloads');
    await processDirectory(downloadsDir, '/downloads');
    
    // Process uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await processDirectory(uploadsDir, '/uploads');
    
    // Sort by creation date (newest first)
    media.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      sessionId,
      media
    });
  } catch (error) {
    console.error('Error listing session media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list session media'
    });
  }
});

/**
 * @swagger
 * /api/management/media/download/{sessionId}/{filename}:
 *   get:
 *     tags: [Media]
 *     summary: Download a media file
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Media file download
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/download/:sessionId/:filename', authenticateToken, async (req, res) => {
  try {
    const { sessionId, filename } = req.params;
    const userId = req.user.id;
    
    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }
    
    let filePath = null;
    
    // Check in downloads directory first
    const downloadsPath = path.join(process.cwd(), 'downloads', filename);
    try {
      await fs.access(downloadsPath);
      filePath = downloadsPath;
    } catch (error) {
      // File not found in downloads
    }
    
    // Check in uploads directory if not found in downloads
    if (!filePath && sessionId === 'uploads') {
      const uploadsPath = path.join(process.cwd(), 'uploads', filename);
      try {
        await fs.access(uploadsPath);
        filePath = uploadsPath;
      } catch (error) {
        // File not found in uploads
      }
    }
    
    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download media'
    });
  }
});

/**
 * @swagger
 * /api/management/media/preview/{sessionId}/{filename}:
 *   get:
 *     tags: [Media]
 *     summary: Preview a media file (for images)
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Media file for preview
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/preview/:sessionId/:filename', authenticateToken, async (req, res) => {
  try {
    const { sessionId, filename } = req.params;
    const userId = req.user.id;
    
    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }
    
    let filePath = null;
    
    // Check in downloads directory first
    const downloadsPath = path.join(process.cwd(), 'downloads', filename);
    try {
      await fs.access(downloadsPath);
      filePath = downloadsPath;
    } catch (error) {
      // File not found in downloads
    }
    
    // Check in uploads directory if not found in downloads
    if (!filePath && sessionId === 'uploads') {
      const uploadsPath = path.join(process.cwd(), 'uploads', filename);
      try {
        await fs.access(uploadsPath);
        filePath = uploadsPath;
      } catch (error) {
        // File not found in uploads
      }
    }
    
    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Get file extension for content type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    // Stream the file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error previewing media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview media'
    });
  }
});

module.exports = router;