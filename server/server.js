const express = require('express');
const path = require('path');
const plist = require('plist');
const archiver = require('archiver');
const fs = require('fs');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/build')));

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Netskope MDM Configuration Generator API',
      version: '1.0.0',
      description: 'API for generating Netskope MDM configuration files',
    },
  },
  apis: ['./server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// In-memory storage for generated files (in production, use a proper database)
const generatedFiles = new Map();

/**
 * @swagger
 * /api/generate:
 *   post:
 *     summary: Generate configuration files
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mdmPlatform:
 *                 type: string
 *               tenantName:
 *                 type: string
 *               topLevelDomain:
 *                 type: string
 *               organizationKey:
 *                 type: string
 *               enrollmentAuthToken:
 *                 type: string
 *               enrollmentEncryptionToken:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful response with download link
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 downloadLink:
 *                   type: string
 */
app.post('/api/generate', (req, res) => {
  const { mdmPlatform, tenantName, topLevelDomain, organizationKey, enrollmentAuthToken, enrollmentEncryptionToken, email } = req.body;

  // Generate files (reuse existing logic)
  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = fs.createWriteStream(path.join(__dirname, 'temp', `${uuidv4()}.zip`));
  
  archive.pipe(output);

  // Add files to the archive (reuse existing logic)
  // ...

  archive.finalize();

  output.on('close', () => {
    const fileId = uuidv4();
    generatedFiles.set(fileId, {
      path: output.path,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes from now
    });

    const downloadLink = `/api/download/${fileId}`;
    res.json({ downloadLink });
  });
});

/**
 * @swagger
 * /api/download/{fileId}:
 *   get:
 *     summary: Download generated configuration files
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File download
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: File not found or expired
 */
app.get('/api/download/:fileId', (req, res) => {
  const fileId = req.params.fileId;
  const fileInfo = generatedFiles.get(fileId);

  if (!fileInfo || Date.now() > fileInfo.expiresAt) {
    generatedFiles.delete(fileId);
    return res.status(404).send('File not found or expired');
  }

  res.download(fileInfo.path, 'netskope_config.zip', (err) => {
    if (err) {
      console.error('Download error:', err);
    } else {
      // Clean up the file after successful download
      fs.unlink(fileInfo.path, (unlinkErr) => {
        if (unlinkErr) console.error('File deletion error:', unlinkErr);
      });
      generatedFiles.delete(fileId);
    }
  });
});

// ... (rest of the existing code)

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api-docs`);
});
