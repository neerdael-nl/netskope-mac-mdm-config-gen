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
  const { mdmPlatform, tenantName, topLevelDomain, organizationKey, enrollmentAuthToken, enrollmentEncryptionToken, email } = req.body;

  // Generate plist content
  const plistContent = {
    email: email || '{{email}}',
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
  const preInstallScript = generateCustomPreInstallScript(mdmPlatform, tenantName, topLevelDomain, organizationKey, enrollmentAuthToken, enrollmentEncryptionToken, email);
  archive.append(preInstallScript, { name: 'pre-install.sh' });

  // Add post-install script to zip
  const postInstallPath = path.join(__dirname, 'scripts', 'post-install.sh');
  archive.append(fs.createReadStream(postInstallPath), { name: 'post-install.sh' });

  archive.finalize();
});

function generateCustomPreInstallScript(mdmPlatform, tenantName, topLevelDomain, organizationKey, enrollmentAuthToken, enrollmentEncryptionToken, email) {
  let script = fs.readFileSync(path.join(__dirname, 'scripts', 'pre-install.sh'), 'utf8');
  
  // Replace placeholders with actual values
  script = script.replace('{{TENANT_HOST_NAME}}', `addon-${tenantName}.${topLevelDomain}`);
  script = script.replace('{{ORGANIZATION_KEY}}', organizationKey);
  script = script.replace('{{ENROLLMENT_AUTH_TOKEN}}', enrollmentAuthToken || '');
  script = script.replace('{{ENROLLMENT_ENCRYPTION_TOKEN}}', enrollmentEncryptionToken || '');
  script = script.replace('{{EMAIL}}', email || '{{email}}');
  
  return script;
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
