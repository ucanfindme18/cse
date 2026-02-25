const express = require('express');
const { google } = require('googleapis');
const crypto = require('crypto'); // for webhook signature check

const app = express();
app.use(express.json());

// === CONFIG - REPLACE THESE ===
const PAYMONGO_WEBHOOK_SECRET = 'whsk_RHm1B67RkMK2o4EwoUsqJv4Q'; // From PayMongo webhook settings
const GOOGLE_FOLDER_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz'; // Your Drive folder ID
// credentials.json should be uploaded as a file in Render (see step 3)

// Google Drive setup
let drive;
(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFilename: './credentials.json', // Render will have this file
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  drive = google.drive({ version: 'v3', auth });
})();

// === PAYMONGO WEBHOOK ENDPOINT ===
app.post('/webhook', (req, res) => {
  // Verify signature (PayMongo sends 'paymongo-signature' header)
  const signature = req.headers['paymongo-signature'];
  if (!signature) return res.status(401).send('No signature');

  // PayMongo uses HMAC-SHA256 with your webhook secret
  const computedSig = crypto
    .createHmac('sha256', PAYMONGO_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (computedSig !== signature) {
    console.log('Invalid signature');
    return res.status(401).send('Invalid signature');
  }

  const event = req.body.data.attributes.event;

  if (event === 'payment.paid' || event === 'payment.succeeded') {
    // PayMongo doesn't send email by default — you must pass it in metadata when creating payment
    // For now, log it — later we'll add metadata handling
    const paymentData = req.body.data.attributes.data.attributes;
    console.log('Payment success:', paymentData);

    // If you passed email in metadata during payment creation:
    // const email = paymentData.metadata?.customer_email;
    // if (email && email.endsWith('@gmail.com')) {
    //   addToDrive(email);
    // }
  }

  res.sendStatus(200); // Always 200 to acknowledge
});

// === MANUAL ADD EMAIL (from your HTML form) ===
app.post('/add-email', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.endsWith('@gmail.com')) {
    return res.json({ success: false, message: 'Invalid Gmail' });
  }

  try {
    await drive.permissions.create({
      fileId: GOOGLE_FOLDER_ID,
      requestBody: {
        role: 'reader',
        type: 'user',
        emailAddress: email,
      },
      fields: 'id',
    });
    console.log(`Added ${email} to Drive folder`);
    res.json({ success: true, message: 'Access granted! Check Drive or Messenger for link.' });
  } catch (err) {
    console.error('Drive error:', err);
    res.json({ success: false, message: 'Failed to add access. Message us.' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
