const express = require('express');
const path = require('path');
const plist = require('plist');
const archiver = require('archiver');
const fs = require('fs');

const app = express();
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/build')));

app.post('/api/generate-zip', (req, res) => {
  const { tenantName, topLevelDomain, organizationKey, enrollmentAuthToken, enrollmentEncryptionToken } = req.body;

  // Generate plist content
  const plistContent = {
    email: '{{email}}',
    addonhost: `addon-${tenantName}.${topLevelDomain}`,
    orgkey: organizationKey
  };

  // Create a zip file
  const archive = archiver('zip', { zlib: { level: 9 } });
  res.attachment('netskope_config.zip');
  archive.pipe(res);

  // Add plist to zip
  const plistString = plist.build(plistContent);
  archive.append(plistString, { name: 'com.netskope.client.Netskope-Client.plist' });

  // Generate and add custom pre-install script
  const preInstallScript = generateCustomPreInstallScript(tenantName, topLevelDomain, organizationKey, enrollmentAuthToken, enrollmentEncryptionToken);
  archive.append(preInstallScript, { name: 'intune-pre-install.sh' });

  // Add post-install script to zip
  const postInstallPath = path.join(__dirname, 'scripts', 'intune-post-install.sh');
  archive.append(fs.createReadStream(postInstallPath), { name: 'intune-post-install.sh' });

  archive.finalize();
});

function generateCustomPreInstallScript(tenantName, topLevelDomain, organizationKey, enrollmentAuthToken, enrollmentEncryptionToken) {
  let script = fs.readFileSync(path.join(__dirname, 'scripts', 'intune-pre-install.sh'), 'utf8');
  
  // Replace placeholders with actual values
  script = script.replace('{{TENANT_HOST_NAME}}', `addon-${tenantName}.${topLevelDomain}`);
  script = script.replace('{{ORGANIZATION_KEY}}', organizationKey);
  
  if (enrollmentAuthToken) {
    script = script.replace('{{ENROLLMENT_AUTH_TOKEN}}', enrollmentAuthToken);
  } else {
    script = script.replace('{{ENROLLMENT_AUTH_TOKEN}}', '');
  }
  
  if (enrollmentEncryptionToken) {
    script = script.replace('{{ENROLLMENT_ENCRYPTION_TOKEN}}', enrollmentEncryptionToken);
  } else {
    script = script.replace('{{ENROLLMENT_ENCRYPTION_TOKEN}}', '');
  }
  
  return script;
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
