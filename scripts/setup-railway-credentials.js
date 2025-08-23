#!/usr/bin/env node

/**
 * Helper script to set up Gmail credentials for Railway deployment
 * This script helps you upload your local credentials to Railway volume
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOCAL_CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.gmail-mcp');
const LOCAL_OAUTH_PATH = path.join(LOCAL_CONFIG_DIR, 'gcp-oauth.keys.json');
const LOCAL_CREDENTIALS_PATH = path.join(LOCAL_CONFIG_DIR, 'credentials.json');

console.log('🚀 Railway Gmail Credentials Setup Helper\n');

// Check if local credentials exist
if (!fs.existsSync(LOCAL_OAUTH_PATH)) {
    console.error('❌ OAuth keys file not found at:', LOCAL_OAUTH_PATH);
    console.error('Please run the auth flow locally first: npm run auth');
    process.exit(1);
}

if (!fs.existsSync(LOCAL_CREDENTIALS_PATH)) {
    console.error('❌ Credentials file not found at:', LOCAL_CREDENTIALS_PATH);
    console.error('Please run the auth flow locally first: npm run auth');
    process.exit(1);
}

console.log('✅ Found local credentials');
console.log('📁 OAuth keys:', LOCAL_OAUTH_PATH);
console.log('📁 Credentials:', LOCAL_CREDENTIALS_PATH);

// Read and validate the files
try {
    const oauthContent = JSON.parse(fs.readFileSync(LOCAL_OAUTH_PATH, 'utf8'));
    const credentialsContent = JSON.parse(fs.readFileSync(LOCAL_CREDENTIALS_PATH, 'utf8'));
    
    const keys = oauthContent.installed || oauthContent.web;
    if (!keys || !keys.client_id || !keys.client_secret) {
        throw new Error('Invalid OAuth keys format');
    }
    
    if (!credentialsContent.refresh_token) {
        throw new Error('No refresh token found in credentials');
    }
    
    console.log('✅ Credentials validated successfully\n');
    
    // Provide instructions for Railway deployment
    console.log('📋 Railway Deployment Instructions:');
    console.log('');
    console.log('1. Create a volume in your Railway project:');
    console.log('   railway volume create gmail-credentials');
    console.log('');
    console.log('2. Upload your credential files to the volume:');
    console.log('   railway volume mount gmail-credentials');
    console.log('   # This will mount the volume locally, then copy files:');
    console.log(`   cp "${LOCAL_OAUTH_PATH}" /path/to/mounted/volume/gcp-oauth.keys.json`);
    console.log(`   cp "${LOCAL_CREDENTIALS_PATH}" /path/to/mounted/volume/credentials.json`);
    console.log('');
    console.log('3. Alternatively, set environment variables in Railway dashboard:');
    console.log(`   GMAIL_CLIENT_ID=${keys.client_id}`);
    console.log(`   GMAIL_CLIENT_SECRET=${keys.client_secret}`);
    console.log(`   GMAIL_REFRESH_TOKEN=${credentialsContent.refresh_token}`);
    if (credentialsContent.access_token) {
        console.log(`   GMAIL_ACCESS_TOKEN=${credentialsContent.access_token}`);
    }
    console.log('');
    console.log('4. Deploy your application:');
    console.log('   railway up');
    console.log('');
    console.log('🎉 Your Gmail MCP server will be ready on Railway!');
    
} catch (error) {
    console.error('❌ Error validating credentials:', error.message);
    process.exit(1);
}