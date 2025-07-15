const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: process.env.MAILTRAP_PORT,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS
  }
});

transporter.sendMail({
  from: 'no-reply@yourapp.com',
  to: 'test@example.com',
  subject: 'Test Mailtrap',
  text: 'Hello from Mailtrap!'
}).then(() => console.log('Sent!')).catch(console.error); 