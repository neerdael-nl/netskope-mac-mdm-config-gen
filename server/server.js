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
 *     description: Generates MDM configuration files for Netskope deployment with optional multi-user support
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
 *                 description: The MDM platform to generate configuration for
 *               tenantName:
 *                 type: string
 *                 description: Tenant name (e.g., 'john' for john.goskope.com)
 *               topLevelDomain:
 *                 type: string
 *                 description: Top level domain for the tenant
 *               organizationKey:
 *                 type: string
 *                 description: Organization ID/Key
 *               enrollmentAuthToken:
 *                 type: string
 *                 description: Optional enrollment authentication token
 *               enrollmentEncryptionToken:
 *                 type: string
 *                 description: Optional enrollment encryption token
 *               email:
 *                 type: string
 *                 description: Optional email for development and testing
 *               isMultiUser:
 *                 type: boolean
 *                 description: Whether to enable multi-user configuration mode
 *                 default: false
 *             required:
 *               - mdmPlatform
 *               - tenantName
 *               - topLevelDomain
 *               - organizationKey
 *             example:
 *               mdmPlatform: "Microsoft Intune"
 *               tenantName: "john"
 *               topLevelDomain: "goskope.com"
 *               organizationKey: "abc123"
 *               enrollmentAuthToken: "auth123"
 *               enrollmentEncryptionToken: "enc456"
 *               email: "test@example.com"
 *               isMultiUser: false
 *     responses:
 *       200:
 *         description: Successful response with zip file containing configuration
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
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
  const { mdmPlatform, tenantName, topLevelDomain, organizationKey, enrollmentAuthToken, enrollmentEncryptionToken, email, isMultiUser } = req.body;

  // Create temp directory if it doesn't exist
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  try {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = fs.createWriteStream(path.join(tempDir, `${uuidv4()}.zip`));
    
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

    // Modify and add pre-install and post-install scripts
    const preInstallPath = path.join(__dirname, 'scripts', 'pre-install.sh');
    const postInstallPath = path.join(__dirname, 'scripts', 'post-install.sh');

    let preInstallContent = await fsPromises.readFile(preInstallPath, 'utf8');
    let postInstallContent = await fsPromises.readFile(postInstallPath, 'utf8');

    // Modify the multi-user configuration section
    const multiUserConfig = `
# Multi-user configuration
if [ $perusermode -eq 1 ]
then
    NSUSERCONFIG_JSON_FILE="/Library/Application Support/Netskope/STAgent/nsuserconfig.json"
    NSINSTPARAM_JSON_FILE="/tmp/nsbranding/nsinstparams.json"
    
    mkdir -p "/Library/Application Support/Netskope/STAgent"
    
    # Create the empty install param json file so that IDP mode will not trigger in case of any failure
    echo -n > "$NSINSTPARAM_JSON_FILE"
    
    addonUrl="addon-${tenantName}.${topLevelDomain}"
    echo "Addonman url is $addonUrl"
    
    if [[ $addonUrl != addon-* ]]; then
        echo "Addonman url does not start with addon-"
        exit 1
    fi
    
    orgkey="${organizationKey}"
    
    echo "{\\\"nsUserConfig\\\":{\\\"enablePerUserConfig\\\": \\\"true\\\", \\\"configLocation\\\": \\\"~/Library/Application Support/Netskope/STAgent\\\", \\\"token\\\": \\\"$orgkey\\\", \\\"host\\\": \\\"$addonUrl\\\",\\\"autoupdate\\\": \\\"true\\\"}}" > "$NSUSERCONFIG_JSON_FILE"
    
    exit 0
fi
`;

    // Add this before the multi-user configuration in the pre-install script
    const modeConfig = `
# Set per-user mode
perusermode=${isMultiUser ? 1 : 0}
`;

    // Insert both configurations before the last line
    const lastNewlineIndex = preInstallContent.lastIndexOf('\n');
    preInstallContent = 
      preInstallContent.slice(0, lastNewlineIndex) + 
      '\n' + 
      modeConfig +
      multiUserConfig + 
      preInstallContent.slice(lastNewlineIndex);

    // Replace placeholders in scripts
    const replacements = {
      '{{TENANT_HOST_NAME}}': `addon-${tenantName}.${topLevelDomain}`,
      '{{EMAIL}}': plistEmail,
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

    // Modify the plist generation for Intune
    if (mdmPlatform === 'Microsoft Intune') {
      const intuneContent = `<key>Email</key>
<string>{{mail}}</string>`;
      archive.append(intuneContent, { name: 'com.netskope.client.Netskope-Client.plist' });
    } else {
      const customPlist = plist.build({
        Email: plistEmail
      });
      archive.append(customPlist, { name: 'com.netskope.client.Netskope-Client.plist' });
    }

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