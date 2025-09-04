const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');
const database = require('../config/database');

const router = express.Router();


const DOWNLOADS_COLLECTION = 'downloaded_files';
const SESSIONS_COLLECTION = 'whatsapp_sessions';
















































router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id || req.user._id?.toString();
    const db = database.getDb();

    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Database not available'
      });
    }

    const getFileType = (mimetype, filename) => {
      if (!mimetype) {

        const ext = path.extname(filename).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'image';
        if (['.mp4', '.avi', '.mov', '.wmv', '.webm'].includes(ext)) return 'video';
        if (['.mp3', '.wav', '.m4a', '.ogg', '.opus'].includes(ext)) return 'audio';
        if (['.pdf'].includes(ext)) return 'pdf';
        if (['.doc', '.docx'].includes(ext)) return 'document';
        return 'other';
      }

      if (mimetype.startsWith('image/')) return 'image';
      if (mimetype.startsWith('video/')) return 'video';
      if (mimetype.startsWith('audio/')) return 'audio';
      if (mimetype === 'application/pdf') return 'pdf';
      if (mimetype.includes('document') || mimetype.includes('word')) return 'document';
      return 'other';
    };

    let media = [];

    if (sessionId === 'uploads') {

      const uploadsDir = path.join(process.cwd(), 'uploads');
      try {
        const uploadFiles = await fs.readdir(uploadsDir, { withFileTypes: true });

        for (const file of uploadFiles) {
          if (file.isFile() && !file.name.startsWith('.')) {
            const filePath = path.join(uploadsDir, file.name);
            const stats = await fs.stat(filePath);
            const fileType = getFileType(null, file.name);

            media.push({
              id: `upload_${file.name}`,
              filename: file.name,
              originalFileName: file.name,
              type: fileType,
              mimetype: 'unknown',
              size: stats.size,
              createdAt: stats.birthtime.toISOString(),
              downloadUrl: `/api/management/media/download/uploads/${encodeURIComponent(file.name)}`,
              previewUrl: fileType === 'image' ? `/api/management/media/preview/uploads/${encodeURIComponent(file.name)}` : null,
              sessionId: 'uploads',
              source: 'uploads'
            });
          }
        }
      } catch (error) {
        console.warn('Uploads directory not accessible:', error.message);
      }
    } else {

      const sessions = global.whatsappSessions;
      if (!sessions || !sessions.has(sessionId)) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      const sessionData = sessions.get(sessionId);
      if (!sessionData.userId || sessionData.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: you do not own this session'
        });
      }


      const mediaFiles = await db.collection(DOWNLOADS_COLLECTION)
        .find({ sessionId: sessionId })
        .sort({ createdAt: -1 })
        .toArray();


      for (const mediaFile of mediaFiles) {
        const fileType = getFileType(mediaFile.mimetype, mediaFile.originalFileName);


        const filePath = mediaFile.filePath;
        let fileExists = true;
        let actualSize = mediaFile.size;

        try {
          const stats = await fs.stat(filePath);
          actualSize = stats.size;
        } catch (error) {
          fileExists = false;
          console.warn(`File not found on disk: ${filePath}`);
        }

        media.push({
          id: mediaFile.downloadId,
          filename: mediaFile.safeFileName || mediaFile.originalFileName,
          originalFileName: mediaFile.originalFileName,
          type: fileType,
          mimetype: mediaFile.mimetype,
          size: actualSize,
          createdAt: mediaFile.createdAt.toISOString(),
          uploadedAt: mediaFile.uploadedAt ? mediaFile.uploadedAt.toISOString() : null,
          downloadUrl: `/api/management/media/download/${sessionId}/${encodeURIComponent(mediaFile.safeFileName || mediaFile.originalFileName)}`,
          previewUrl: fileType === 'image' ? `/api/management/media/preview/${sessionId}/${encodeURIComponent(mediaFile.safeFileName || mediaFile.originalFileName)}` : null,
          sessionId: sessionId,
          messageId: mediaFile.messageId,
          messageType: mediaFile.messageType,
          isPtt: mediaFile.isPtt || false,
          fileExists: fileExists,
          source: 'whatsapp'
        });
      }
    }

    res.json({
      success: true,
      sessionId,
      sessionName: sessionId === 'uploads' ? 'Uploads Gerais' : sessionId,
      media,
      totalFiles: media.length,
      totalSize: media.reduce((sum, file) => sum + (file.size || 0), 0)
    });

  } catch (error) {
    console.error('Error listing session media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list session media',
      error: error.message
    });
  }
});





























router.get('/download/:sessionId/:filename', authenticateToken, async (req, res) => {
  try {
    const { sessionId, filename } = req.params;
    const userId = req.user.id || req.user._id?.toString();
    const db = database.getDb();


    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }

    let filePath = null;
    let originalFileName = filename;
    let mimetype = 'application/octet-stream';

    if (sessionId === 'uploads') {

      const uploadsPath = path.join(process.cwd(), 'uploads', filename);
      try {
        await fs.access(uploadsPath);
        filePath = uploadsPath;
        originalFileName = filename;
      } catch (error) {
        return res.status(404).json({
          success: false,
          message: 'File not found in uploads'
        });
      }
    } else {

      const sessions = global.whatsappSessions;
      if (!sessions || !sessions.has(sessionId)) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      const sessionData = sessions.get(sessionId);
      if (!sessionData.userId || sessionData.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: you do not own this session'
        });
      }


      if (db) {


        const mediaFile = await db.collection(DOWNLOADS_COLLECTION).findOne({
          sessionId: sessionId,
          $or: [
            { safeFileName: filename },
            { originalFileName: filename }
          ]
        });

        if (mediaFile) {
          filePath = mediaFile.filePath;
          originalFileName = mediaFile.originalFileName || filename;
          mimetype = mediaFile.mimetype || 'application/octet-stream';


          try {
            await fs.access(filePath);
          } catch (error) {
            return res.status(404).json({
              success: false,
              message: 'File not found on disk'
            });
          }
        } else {

          const downloadsPath = path.join(process.cwd(), 'downloads', filename);
          try {
            await fs.access(downloadsPath);
            filePath = downloadsPath;
          } catch (error) {
            return res.status(404).json({
              success: false,
              message: 'File not found'
            });
          }
        }
      } else {

        const downloadsPath = path.join(process.cwd(), 'downloads', filename);
        try {
          await fs.access(downloadsPath);
          filePath = downloadsPath;
        } catch (error) {
          return res.status(404).json({
            success: false,
            message: 'File not found'
          });
        }
      }
    }

    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }


    res.setHeader('Content-Disposition', `attachment; filename="${originalFileName}"`);
    res.setHeader('Content-Type', mimetype);


    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download media',
      error: error.message
    });
  }
});





























router.get('/preview/:sessionId/:filename', authenticateToken, async (req, res) => {
  try {
    const { sessionId, filename } = req.params;
    const userId = req.user.id || req.user._id?.toString();
    const db = database.getDb();


    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }

    let filePath = null;
    let mimetype = 'application/octet-stream';

    if (sessionId === 'uploads') {

      const uploadsPath = path.join(process.cwd(), 'uploads', filename);
      try {
        await fs.access(uploadsPath);
        filePath = uploadsPath;
      } catch (error) {
        return res.status(404).json({
          success: false,
          message: 'File not found in uploads'
        });
      }
    } else {

      const sessions = global.whatsappSessions;
      if (!sessions || !sessions.has(sessionId)) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      const sessionData = sessions.get(sessionId);
      if (!sessionData.userId || sessionData.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: you do not own this session'
        });
      }


      if (db) {


        const mediaFile = await db.collection(DOWNLOADS_COLLECTION).findOne({
          sessionId: sessionId,
          $or: [
            { safeFileName: filename },
            { originalFileName: filename }
          ]
        });

        if (mediaFile) {
          filePath = mediaFile.filePath;
          mimetype = mediaFile.mimetype || 'application/octet-stream';


          try {
            await fs.access(filePath);
          } catch (error) {
            return res.status(404).json({
              success: false,
              message: 'File not found on disk'
            });
          }
        } else {

          const downloadsPath = path.join(process.cwd(), 'downloads', filename);
          try {
            await fs.access(downloadsPath);
            filePath = downloadsPath;
          } catch (error) {
            return res.status(404).json({
              success: false,
              message: 'File not found'
            });
          }
        }
      } else {

        const downloadsPath = path.join(process.cwd(), 'downloads', filename);
        try {
          await fs.access(downloadsPath);
          filePath = downloadsPath;
        } catch (error) {
          return res.status(404).json({
            success: false,
            message: 'File not found'
          });
        }
      }
    }

    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }


    let contentType = mimetype;
    if (!contentType || contentType === 'application/octet-stream') {

      const ext = path.extname(filename).toLowerCase();
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
        default:
          contentType = 'application/octet-stream';
      }
    }


    if (!contentType.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Preview is only available for image files'
      });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');


    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error previewing media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview media',
      error: error.message
    });
  }
});

module.exports = router;