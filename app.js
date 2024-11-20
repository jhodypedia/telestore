// app.js
const express = require('express');
const bodyParser = require('body-parser');
const midtransClient = require('midtrans-client');
const db = require('./src/db'); // Import koneksi database
const bot = require('./src/bot'); // Import bot dari src/bot.js
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json()); // Middleware untuk body JSON

// Konfigurasi Midtrans
const snap = new midtransClient.Snap({
  isProduction: false, // Gunakan `true` untuk production
  serverKey: 'SB-Mid-server-MfkAjiPObqTJpovidnqxBtoH', // Ganti dengan Server Key Anda
  clientKey: 'SB-Mid-client-MoQGXib5PLvo43Ek', // Ganti dengan Client Key Anda
});

app.get('/', (req, res) => {
  res.status(404).send('404 Not Found');
});

// Webhook untuk memverifikasi pembayaran otomatis
app.post('/verify_payment', (req, res) => {
  const notification = req.body; // Data notifikasi dari Midtrans

  // Verifikasi tanda tangan untuk memastikan ini adalah notifikasi yang sah dari Midtrans
  const signatureKey = req.headers['x-signature']; // Tanda tangan dari header
  const serverKey = 'SB-Mid-server-MfkAjiPObqTJpovidnqxBtoH'; // Server Key Midtrans Anda
  const expectedSignature = crypto.createHmac('sha512', serverKey)
    .update(`${notification.order_id}|${notification.transaction_status}|${notification.gross_amount}`)
    .digest('hex');

  if (signatureKey !== expectedSignature) {
    return res.status(400).send('Invalid signature');
  }

  const orderId = notification.order_id;
  const transactionStatus = notification.transaction_status;
  const grossAmount = notification.gross_amount;
  const userId = notification.custom_field1; // Menyimpan user_id saat membuat transaksi

  if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
    // Pembayaran berhasil, update saldo pengguna
    db.query('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Internal Server Error');
      }

      if (results.length === 0) {
        return res.status(404).send('User not found');
      }

      const newSaldo = results[0].saldo + grossAmount; // Menambahkan jumlah deposit ke saldo pengguna

      // Update saldo pengguna di database
      db.query('UPDATE users SET saldo = ? WHERE telegram_id = ?', [newSaldo, userId], (err, result) => {
        if (err) {
          console.error('Error updating saldo:', err);
          return res.status(500).send('Internal Server Error');
        }

        // Kirim pesan sukses ke pengguna
        bot.sendMessage(userId, `Deposit berhasil! Saldo Anda sekarang: ${newSaldo}`);
        
        // Kirim respons OK ke Midtrans
        return res.status(200).send('Payment verified and saldo updated');
      });
    });
  } else {
    return res.status(400).send('Payment failed');
  }
});

// Menjalankan server Express
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
