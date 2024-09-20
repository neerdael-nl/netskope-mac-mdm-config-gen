#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Check if script is run as root
if [ "$(id -u)" != "0" ]; then
   log "Error: This script must be run as root" 
   exit 1
fi

# Check if /Library/Application Support/Netskope exists and delete it if it does
netskopeFolder="/Library/Application Support/Netskope"
nsbrandingFolder="/tmp/nsbranding"

# Check and delete Netskope folder if it exists
if [ -d "$netskopeFolder" ]; then
    log "Found existing Netskope folder. Deleting..."
    rm -rf "$netskopeFolder"
    log "Netskope folder deleted."
else
    log "No existing Netskope folder found."
fi

# Check and delete nsbranding folder if it exists
if [ -d "$nsbrandingFolder" ]; then
    log "Found existing nsbranding folder. Deleting..."
    rm -rf "$nsbrandingFolder"
    log "nsbranding folder deleted."
else
    log "No existing nsbranding folder found."
fi

log "Folder check and cleanup completed."

# Create the nsbranding directory if it doesn't exist
mkdir -p /tmp/nsbranding

# Define the path to the nsinstparams.json file
jsonFilePath="/tmp/nsbranding/nsinstparams.json"

# Write the JSON content to nsinstparams.json
cat > "$jsonFilePath" <<EOF
{"TenantHostName":"{{TENANT_HOST_NAME}}", "Email":"{{EMAIL}}", "OrgKey":"{{ORGANIZATION_KEY}}"}
EOF

log "Installation parameters written to $jsonFilePath"

# Handle enrollment tokens
enrollauthtoken="{{ENROLLMENT_AUTH_TOKEN}}"
enrollencryptiontoken="{{ENROLLMENT_ENCRYPTION_TOKEN}}"

if [ -n "$enrollauthtoken" ] || [ -n "$enrollencryptiontoken" ]; then
    tokenFile="/tmp/nsbranding/enroll.conf"
    tokenJson="{"
    [ -n "$enrollauthtoken" ] && tokenJson+="\"enrollauthtoken\": \"$enrollauthtoken\""
    [ -n "$enrollauthtoken" ] && [ -n "$enrollencryptiontoken" ] && tokenJson+=", "
    [ -n "$enrollencryptiontoken" ] && tokenJson+="\"enrollencryptiontoken\": \"$enrollencryptiontoken\""
    tokenJson+="}"
    echo "$tokenJson" > "$tokenFile"
    log "Enrollment token(s) written to $tokenFile"
else
    log "Secure enrollment not enabled. Both enrollment tokens are empty."
fi

log "Pre-installation script completed successfully."