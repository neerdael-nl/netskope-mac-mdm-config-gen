import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

const topLevelDomains = ['au.goskope.com', 'ca.goskope.com', 'de.goskope.com', 'eu.goskope.com', 'eur.goskope.com', 'fr.goskope.com', 'goskope.com', 'in.goskope.com', 'jp.goskope.com', 'na-eur.goskope.com', 'na.goskope.com', 'uk.goskope.com', 'us.goskope.com'];

function App() {
  const [formData, setFormData] = useState({
    tenantName: '',
    topLevelDomain: 'goskope.com',
    organizationKey: '',
    enrollmentAuthToken: '',
    enrollmentEncryptionToken: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/generate-zip', formData, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'netskope_config.zip');
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error('Error generating zip file:', error);
      alert('Error generating zip file. Please try again.');
    }
  };

  return (
    <div className="App">
      <div className="container">
        <h1>Netskope Intune MDM Script Generator</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="tenantName">Tenant Name</label>
            <input
              id="tenantName"
              name="tenantName"
              value={formData.tenantName}
              onChange={handleChange}
              placeholder="Enter tenant name (ex. john for john.goskope.com, do not add the domain)"
              pattern="[^.]*"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="topLevelDomain">Top Level Domain</label>
            <select
              id="topLevelDomain"
              name="topLevelDomain"
              value={formData.topLevelDomain}
              onChange={handleChange}
            >
              {topLevelDomains.map(domain => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="organizationKey">Organization Key</label>
            <input
              id="organizationKey"
              name="organizationKey"
              value={formData.organizationKey}
              onChange={handleChange}
              placeholder="Enter Organization Key"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="enrollmentAuthToken">Enrollment Auth Token (optional)</label>
            <input
              id="enrollmentAuthToken"
              name="enrollmentAuthToken"
              value={formData.enrollmentAuthToken}
              onChange={handleChange}
              placeholder="Enter Enrollment Auth Token"
            />
          </div>
          <div className="form-group">
            <label htmlFor="enrollmentEncryptionToken">Enrollment Encryption Token (optional)</label>
            <input
              id="enrollmentEncryptionToken"
              name="enrollmentEncryptionToken"
              value={formData.enrollmentEncryptionToken}
              onChange={handleChange}
              placeholder="Enter Enrollment Encryption Token"
            />
          </div>
          <button type="submit">Generate Configuration</button>
        </form>
      </div>
    </div>
  );
}

export default App;