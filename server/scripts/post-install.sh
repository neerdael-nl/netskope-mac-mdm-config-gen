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

# Define the paths
jsonFilePath="/tmp/nsbranding/nsinstparams.json"
tokenFilePath="/tmp/nsbranding/enroll.conf"
nsbrandingDir="/tmp/nsbranding"

# Function to safely remove a file
remove_file() {
    local file="$1"
    if [ -f "$file" ]; then
        rm -f "$file"
        log "Removed $file."
    else
        log "$file does not exist."
    fi
}

# Remove the files
remove_file "$jsonFilePath"
remove_file "$tokenFilePath"

# Check if the nsbranding directory is empty and remove it if so
if [ -d "$nsbrandingDir" ] && [ -z "$(ls -A "$nsbrandingDir")" ]; then
    rmdir "$nsbrandingDir"
    log "Removed empty directory $nsbrandingDir."
else
    log "$nsbrandingDir is either not empty or doesn't exist."
fi

log "Post-installation cleanup completed successfully."