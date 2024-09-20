import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [logs, setLogs] = useState([]);
  const debug = (message) => {
    const logMessage = `${new Date().toISOString()} - ${message}`;
    console.log(logMessage);
    setLogs(prevLogs => [...prevLogs, logMessage]);
  };

  const topLevelDomains = ['au.goskope.com', 'ca.goskope.com', 'de.goskope.com', 'eu.goskope.com', 'eur.goskope.com', 'fr.goskope.com', 'goskope.com', 'in.goskope.com', 'jp.goskope.com', 'na-eur.goskope.com', 'na.goskope.com', 'uk.goskope.com', 'us.goskope.com'];
  const mdmPlatforms = ['Microsoft Intune', 'Workspace ONE', 'JAMF', 'Khandji'];
  const [formData, setFormData] = useState({
    mdmPlatform: 'Microsoft Intune',
    tenantName: '',
    topLevelDomain: 'goskope.com',
    organizationKey: '',
    enrollmentAuthToken: '',
    enrollmentEncryptionToken: '',
    email: ''
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.tenantName.trim()) {
      newErrors.tenantName = 'Tenant Name is required';
    }
    if (!formData.organizationKey.trim()) {
      newErrors.organizationKey = 'Organization Key is required';
    }
    if (formData.email && !isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidEmail = (email) => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  };

  const handleSubmit = async (e) => {
    debug('Form submission started');
    e.preventDefault();
    if (!validateForm()) {
      debug('Form validation failed');
      return;
    }
    debug(`Submitting form data: ${JSON.stringify(formData)}`);
    try {
      debug('Sending request to server...');
      const response = await axios.post('/api/generate', formData, { responseType: 'blob' });
      debug('Received response from server');
      
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'netskope_config.zip');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      debug('File download initiated');
    } catch (error) {
      debug(`Error details: ${error}`);
      if (error.response) {
        debug(`Response status: ${error.response.status}`);
        debug(`Response data: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        debug('No response received');
      } else {
        debug(`Error message: ${error.message}`);
      }
      alert(`Error generating zip file: ${error.message}`);
    }
  };

  const isFormValid = formData.tenantName.trim() && formData.organizationKey.trim();

  return (
    <div className="App">
      <div className="container">
        <h1>Netskope MDM Script Generator</h1>
        <h3>JAMF, VMWare Workspace ONE, Kandji and Microsoft Intune (Validation Needed)</h3>
        <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="mdmPlatform">MDM Platform *</label>
          <select
            id="mdmPlatform"
            name="mdmPlatform"
            value={formData.mdmPlatform}
            onChange={handleChange}
            required
          >
            {mdmPlatforms.map(platform => (
              <option key={platform} value={platform}>{platform}</option>
            ))}
          </select>
        </div>
          <div className="form-group">
            <label htmlFor="tenantName">Tenant Name *</label>
            <input
              id="tenantName"
              name="tenantName"
              value={formData.tenantName}
              onChange={handleChange}
              placeholder="Enter tenant name (ex. john for john.goskope.com, do not add the domain)"
              pattern="[^.]*"
              required
            />
            {errors.tenantName && <div className="error">{errors.tenantName}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="topLevelDomain">Top Level Domain *</label>
            <select
              id="topLevelDomain"
              name="topLevelDomain"
              value={formData.topLevelDomain}
              onChange={handleChange}
              required
            >
              {topLevelDomains.map(domain => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="organizationKey">Organization Key *</label>
            <input
              id="organizationKey"
              name="organizationKey"
              value={formData.organizationKey}
              onChange={handleChange}
              placeholder="Enter Organization Key"
              required
            />
            {errors.organizationKey && <div className="error">{errors.organizationKey}</div>}
          </div>
          <div className="form-group">
            <label htmlFor="enrollmentAuthToken">Enrollment Auth Token (Optional)</label>
            <input
              id="enrollmentAuthToken"
              name="enrollmentAuthToken"
              value={formData.enrollmentAuthToken}
              onChange={handleChange}
              placeholder="Enter Enrollment Auth Token"
            />
          </div>
          <div className="form-group">
            <label htmlFor="enrollmentEncryptionToken">Enrollment Encryption Token (Optional)</label>
            <input
              id="enrollmentEncryptionToken"
              name="enrollmentEncryptionToken"
              value={formData.enrollmentEncryptionToken}
              onChange={handleChange}
              placeholder="Enter Enrollment Encryption Token"
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email (Optional)</label>
            <input
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter email for development and testing purposes only"
            />
            {errors.email && <div className="error">{errors.email}</div>}
          </div>
          <div className="debug-logs">
            <h3>Debug Logs</h3>
            <pre>
              {logs.join('\n')}
            </pre>
          </div>
          <button type="submit" disabled={!isFormValid}>Generate Configuration</button>
        </form>
      </div>
    </div>
  );
}

export default App;