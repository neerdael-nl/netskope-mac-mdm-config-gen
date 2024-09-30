const express = require('express');
const path = require('path');
const plist = require('plist');
const archiver = require('archiver');
const fs = require('fs');
const fsPromises = fs.promises;
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

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
  apis: ['./server/server.js'], // Make sure this path is correct
};

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
 *                 enum: [JAMF, 'Workspace ONE', 'Microsoft Intune', Kandji]
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
 *         description: Successful response with zip file
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
app.post('/api/generate', async (req, res) => {
  console.log('Received generate request:', req.body);
  const { mdmPlatform, tenantName, topLevelDomain, organizationKey, enrollmentAuthToken, enrollmentEncryptionToken, email } = req.body;

  try {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = fs.createWriteStream(path.join(__dirname, 'temp', `${uuidv4()}.zip`));
    
    archive.pipe(output);

    // Generate and add files to the archive
    const mobileConfigPath = path.join(__dirname, 'scripts', 'NetskopeClient.mobileconfig');
    const mobileConfigContent = await fsPromises.readFile(mobileConfigPath, 'utf8');
    
    // Modify the mobileconfig content with user-provided data
    const modifiedMobileConfig = mobileConfigContent
      .replace(/{{tenantName}}/g, tenantName)
      .replace(/{{topLevelDomain}}/g, topLevelDomain)
      .replace(/{{organizationKey}}/g, organizationKey);

    archive.append(modifiedMobileConfig, { name: 'NetskopeClient.mobileconfig' });

    // Generate custom plist file
    let plistEmail = email || '';
    if (mdmPlatform === 'Workspace ONE' && !email) {
      plistEmail = '{EmailUserName}';
    } else if (mdmPlatform === 'Kandji' && !email) {
      plistEmail = '$EMAIL';
    } else if ((mdmPlatform === 'JAMF' || mdmPlatform === 'Microsoft Intune') && !email) {
      plistEmail = '{{mail}}';
    }

    const customPlist = plist.build({
      Email: plistEmail
    });
    archive.append(customPlist, { name: 'com.netskope.client.Netskope-Client.plist' });

    // Modify and add pre-install and post-install scripts
    const preInstallPath = path.join(__dirname, 'scripts', 'pre-install.sh');
    const postInstallPath = path.join(__dirname, 'scripts', 'post-install.sh');

    let preInstallContent = await fsPromises.readFile(preInstallPath, 'utf8');
    let postInstallContent = await fsPromises.readFile(postInstallPath, 'utf8');

    // Add the correct email fetching method to pre-install.sh
    const emailFetchingCode = `
# Managed domain where Netskope client settings are stored
managedDomain="com.netskope.client.Netskope-Client"

# Function to safely read defaults
read_default() {
    local domain="$1"
    local key="$2"
    local value
    value=$(defaults -currentHost read "/Library/Managed Preferences/${domain}" "${key}" 2>/dev/null) || value=""
    echo "$value"
}

# Use the function to read values
email=$(read_default "$managedDomain" "email")

# If email is empty, use a default value or handle it as needed
if [ -z "$email" ]; then
  email="{{EMAIL}}"
fi
`;

    preInstallContent = emailFetchingCode + preInstallContent;

    // Replace placeholders in scripts
    const replacements = {
      '{{TENANT_HOST_NAME}}': `addon-${tenantName}.${topLevelDomain}`,
      '{{EMAIL}}': plistEmail, // Use the plistEmail value, which includes platform-specific placeholders
      '{{ORGANIZATION_KEY}}': organizationKey,
      '{{ENROLLMENT_AUTH_TOKEN}}': enrollmentAuthToken || '',
      '{{ENROLLMENT_ENCRYPTION_TOKEN}}': enrollmentEncryptionToken || '',
      '{{ADDON_HOST}}': `addon-${tenantName}.${topLevelDomain}`
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      preInstallContent = preInstallContent.replace(new RegExp(placeholder, 'g'), value);
      postInstallContent = postInstallContent.replace(new RegExp(placeholder, 'g'), value);
    }

    archive.append(preInstallContent, { name: 'pre-install.sh' });
    archive.append(postInstallContent, { name: 'post-install.sh' });

    archive.finalize();

    output.on('close', () => {
      console.log('Archive created successfully');
      const filePath = output.path;
      res.download(filePath, 'netskope_config.zip', (err) => {
        if (err) {
          console.error('Download error:', err);
          res.status(500).send('Error downloading file');
        }
        // Delete the file after sending
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Error deleting file:', unlinkErr);
          }
        });
      });
    });

    archive.on('error', (err) => {
      console.error('Error creating archive:', err);
      res.status(500).json({ error: 'Error creating archive' });
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ error: 'Unexpected error occurred' });
  }
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
app.get('/api/download/:fileId', async (req, res) => {
  const fileId = req.params.fileId;
  const fileInfo = generatedFiles.get(fileId);

  if (!fileInfo || Date.now() > fileInfo.expiresAt) {
    generatedFiles.delete(fileId);
    return res.status(404).send('File not found or expired');
  }

  res.download(fileInfo.path, 'netskope_config.zip', async (err) => {
    if (err) {
      console.error('Download error:', err);
    } else {
      try {
        await fs.unlink(fileInfo.path);
      } catch (unlinkErr) {
        console.error('File deletion error:', unlinkErr);
      }
      generatedFiles.delete(fileId);
    }
  });
});

// Add this at the end of the file, just before app.listen()
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api-docs`);
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});