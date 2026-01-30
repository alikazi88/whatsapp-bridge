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

# Install Chromium/Puppeteer system dependencies
sudo apt-get install -y libgbm-dev wget gnupg libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libasound2
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

## 4. Finalizing Dashboard Connection

1. Open `dashboard/src/config.ts` on your local machine.
2. Update the bridge URL:
   ```typescript
   export const WHATSAPP_BRIDGE_URL = 'http://your-elastic-ip:3001';
   ```
3. Re-build your dashboard (`npm run build`) and upload the `dist` folder to your web hosting (FileZilla).

---

## Troubleshooting
- **QR Not Appearing**: Ensure port 3001 is open in AWS Security Groups.
- **Memory Issues**: If the bridge crashes during scan, upgrade from `t2.micro` to `t3.small`.
- **Session Loss**: The bridge saves sessions in the `.wwebjs_auth` folder. Do not delete this folder.
