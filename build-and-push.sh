#!/bin/bash

# Set up buildx
docker buildx create --use

# Build and push multi-arch image
docker buildx build --platform linux/amd64,linux/arm64 -t johnneerdael/netskope-intune-mdm-generator:latest --push .