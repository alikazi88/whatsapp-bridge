# WhatsApp Bridge Deployment Guide (AWS EC2)

This guide covers deploying the multi-tenant WhatsApp Bridge on an AWS EC2 instance.

## 1. AWS EC2 Setup

### Launch Instance
- **AMI**: Ubuntu 22.04 LTS (64-bit x86).
- **Instance Type**: `t3.small` (2 vCPU, 2GB RAM) is recommended. Puppeteer requires significant memory to run Chromium.
- **Key Pair**: Download your `.pem` key for SSH access.
- **Storage**: 20GB GP3 SSD is sufficient.

### Network Configuration (Security Group)
You must allow traffic on the bridge port:
1. Go to **Security Groups** > **Edit Inbound Rules**.
2. Add the following rules:
   - **SSH** (22): `My IP` (for your security).
   - **Custom TCP** (3001): `0.0.0.0/0` (allows the Dashboard to connect).
   - **HTTP** (80): `0.0.0.0/0` (optional, for web access).

### Elastic IP (Static IP)
**CRITICAL**: Without an Elastic IP, your bridge URL will change every time the instance restarts.
1. Go to **Elastic IPs** > **Allocate Elastic IP address**.
2. Select the new IP > **Actions** > **Associate Elastic IP address**.
3. Choose your instance and associate.

---

## 2. Server Configuration

### SSH into your instance
```bash
ssh -i "your-key.pem" ubuntu@your-elastic-ip
```

### Install Node.js & Dependencies
```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chromium/Puppeteer system dependencies (Compatible with Ubuntu 20.04, 22.04, and 24.04)
sudo apt-get update
sudo apt-get install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils || \
sudo apt-get install -y ca-certificates fonts-liberation libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libc6 libcairo2 libcups2t64 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils
```

---

## 3. Deploying the Bridge

1. **Upload Code**: Use SCP or Git to move the `whatsapp-bridge` folder to the server.
   ```bash
   scp -r -i "your-key.pem" ./whatsapp-bridge ubuntu@your-elastic-ip:/home/ubuntu/
   ```

2. **Install & Start**:
   ```bash
   cd ~/whatsapp-bridge
   npm install
   ```

3. **Setup Persistence (PM2)**:
   ```bash
   sudo npm install -g pm2
   pm2 start index.js --name "whatsapp-bridge"
   pm2 save
   pm2 startup
   ```

---

## 4. Enabling HTTPS (SSL) - REQUIRED for Live Dashboard
Since your dashboard is on `https://`, your bridge **must** also be on `https://`. Browsers block `http` requests from `https` sites (Mixed Content Error).

### 1. Point a Domain/Subdomain
1. Go to your domain provider (e.g., Cloudflare, GoDaddy).
2. Create an **A Record** for `bridge.foxmenu.21gfox.ca` pointing to your **Elastic IP** (`51.21.112.191`).

### 2. Install Nginx & Certbot
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 3. Configure Nginx Proxy
Create a config file:
```bash
sudo nano /etc/nginx/sites-available/whatsapp-bridge
```
Paste this:
```nginx
server {
    server_name bridge.foxmenu.21gfox.ca;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-bridge /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Get SSL Certificate
```bash
sudo certbot --nginx -d bridge.foxmenu.21gfox.ca
```
Follow the prompts. Certbot will automatically handle the SSL part.

---

## 5. Finalizing Dashboard Connection

1. Open `dashboard/src/config.ts` on your local machine.
2. Update the bridge URL to your new **HTTPS** domain:
   ```typescript
   export const WHATSAPP_BRIDGE_URL = 'https://bridge.foxmenu.21gfox.ca';
   ```
3. Re-build and re-upload your dashboard.

---

## Troubleshooting
- **QR Not Appearing**: Ensure port 3001 is open in AWS Security Groups.
- **Memory Issues**: If the bridge crashes during scan, upgrade from `t2.micro` to `t3.small`.
- **Session Loss**: The bridge saves sessions in the `.wwebjs_auth` folder. Do not delete this folder.
