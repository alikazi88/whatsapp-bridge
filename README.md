# Fox CRM WhatsApp Bridge (Self-Hosted)

This is a standalone service that allows your Fox CRM Dashboard to send images and PDFs directly to customers via WhatsApp for free.

## Setup Instructions

1.  **System Requirements**: [Node.js](https://nodejs.org/) must be installed on your computer.
2.  **Navigate to Folder**:
    ```bash
    cd whatsapp-bridge
    ```
3.  **Install Dependencies**:
    ```bash
    npm install
    ```
4.  **Start the Bridge**:
    ```bash
    npm start
    ```
5.  **Scan QR Code**: A QR code will appear in your terminal. Scan it with your WhatsApp (Linked Devices) just like WhatsApp Web.

## How it works
- Once the bridge is running, clicking **WhatsApp** in your Fox CRM Dashboard will automatically capture the bill image, upload it to storage, and send it directly through the bridge.
- If the bridge is NOT running, it will gracefully fall back to opening a standard WhatsApp tab with a link.
