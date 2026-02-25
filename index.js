const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');

const app = express();
app.use(express.json());

// REPLACE THESE
const FOLDER_ID = 'https://drive.google.com/drive/u/0/folders/1x-285UpemCCE-SXoQDhugeN893IW06df'; // from Step 1
const WEBHOOK_SECRET = 'whsk_RHm1B67RkMK2o4EwoUsqJv4Q';

// Load Google credentials (upload credentials.json to Render as environment file or secret)
const auth = new google.auth.GoogleAuth({
  keyFile: './credentials.json', // or use env vars
  scopes: ['https://www.googleapis.com/auth/drive']
});

const drive = google.drive({ version: 'v3', auth });

// PayMongo Webhook – Payment Confirmed → Add Email
app.post('/webhook', async (req, res) => {
  const signature = req.headers['paymongo-signature'];
  // Basic secret check (improve later)
  if (req.body.data.attributes.secret !== WEBHOOK_SECRET) {
    return res.status(401).send('Invalid');
  }

  if (req.body.data.attributes.event === 'payment.paid') {
    const email = req.body.data.attributes.data.attributes.email; // if you pass email in metadata
    if (email && email.endsWith('@gmail.com')) {
      try {
        await drive.permissions.create({
          fileId: FOLDER_ID,
          requestBody: {
            role: 'reader',
            type: 'user',
            emailAddress: email
          }
        });
        console.log(`Added ${email} to Drive`);
      } catch (e) {
        console.error(e);
      }
    }
  }
  res.sendStatus(200);
});

// Frontend form submit – Manual trigger if no webhook email
app.post('/add-email', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.endsWith('@gmail.com')) {
    return res.json({ success: false, message: 'Invalid email' });
  }

  try {
    await drive.permissions.create({
      fileId: FOLDER_ID,
      requestBody: {
        role: 'reader',
        type: 'user',
        emailAddress: email
      }
    });
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
