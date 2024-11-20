// src/bot.js
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');  // Import koneksi database
const midtransClient = require('midtrans-client');

// Ganti dengan token Bot Telegram Anda
const token = '7663080542:AAGZ3_w_LAIP2hZKWwGcbavDehQe3jXp-hg';
const bot = new TelegramBot(token, { polling: true });

// Konfigurasi Midtrans
const snap = new midtransClient.Snap({
  isProduction: false, // Gunakan `true` untuk production
  serverKey: 'SB-Mid-server-MfkAjiPObqTJpovidnqxBtoH', // Ganti dengan Server Key Anda
  clientKey: 'SB-Mid-client-MoQGXib5PLvo43Ek', // Ganti dengan Client Key Anda
});

// Menangani perintah /start
bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id;

  // Cek apakah user sudah terdaftar
  db.query('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return;
    }

    if (results.length === 0) {
      // User belum terdaftar, minta registrasi
      bot.sendMessage(userId, 'Silakan registrasi terlebih dahulu dengan mengirimkan /register');
    } else {
      // User terdaftar, lanjutkan ke deposit
      bot.sendMessage(userId, 'Selamat datang kembali! Ketik /deposit untuk melakukan deposit.');
    }
  });
});

// Menangani perintah /register
bot.onText(/\/register/, (msg) => {
  const userId = msg.from.id;

  // Cek apakah user sudah terdaftar
  db.query('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return;
    }

    if (results.length > 0) {
      bot.sendMessage(userId, 'Anda sudah terdaftar!');
      return;
    }

    // Minta email dari pengguna
    bot.sendMessage(userId, 'Silakan masukkan email Anda:');
    bot.once('message', (emailMessage) => {
      const email = emailMessage.text;

      // Minta nomor telepon dari pengguna
      bot.sendMessage(userId, 'Silakan masukkan nomor telepon Anda:');
      bot.once('message', (phoneMessage) => {
        const phone = phoneMessage.text;

        // Simpan pengguna ke database dengan email dan phone
        const query = 'INSERT INTO users (telegram_id, is_registered, email, phone) VALUES (?, ?, ?, ?)';
        db.query(query, [userId, true, email, phone], (err) => {
          if (err) {
            console.error('Error inserting user:', err);
            return;
          }
          bot.sendMessage(userId, 'Registrasi berhasil!');
        });
      });
    });
  });
});

// Menangani perintah /deposit
bot.onText(/\/deposit/, (msg) => {
  const userId = msg.from.id;

  // Cek apakah pengguna sudah terdaftar
  db.query('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return;
    }

    if (results.length === 0 || !results[0].is_registered) {
      bot.sendMessage(userId, 'Silakan registrasi terlebih dahulu dengan mengirimkan /register');
      return;
    }

    // Menampilkan instruksi deposit
    bot.sendMessage(userId, 'Silakan ketik jumlah deposit Anda (contoh: 100000):');
    bot.once('message', (amountMessage) => {
      const amount = parseInt(amountMessage.text);
      if (isNaN(amount) || amount <= 0) {
        bot.sendMessage(userId, 'Jumlah deposit tidak valid, silakan masukkan jumlah yang valid.');
        return;
      }

      // Buat transaksi di Midtrans
      const transactionDetails = {
        order_id: `tx-${Date.now()}`,  // Membuat ID transaksi unik
        gross_amount: amount,             // Jumlah deposit yang dimasukkan pengguna
      };

      const customerDetails = {
        first_name: msg.from.first_name,
        last_name: msg.from.last_name,
        email: results[0].email,  // Mengambil email dari database
        phone: results[0].phone,  // Mengambil nomor telepon dari database
      };

      const parameter = {
        transaction_details: transactionDetails,
        customer_details: customerDetails,
        custom_field1: userId,  // Menyimpan user_id untuk verifikasi
      };

      // Integrasi dengan Midtrans
      snap.createTransaction(parameter)
        .then((transaction) => {
          const paymentUrl = transaction.redirect_url;
          bot.sendMessage(userId, `Silakan lakukan pembayaran melalui link berikut: ${paymentUrl}`);

          // Simpan transaksi di database
          db.query('INSERT INTO transactions (order_id, user_id, amount, status) VALUES (?, ?, ?, ?)', 
          [transactionDetails.order_id, userId, amount, 'pending'], (err, result) => {
            if (err) {
              console.error('Error saving transaction:', err);
              return;
            }
            console.log('Transaction data saved.');
          });
        })
        .catch((error) => {
          console.error('Midtrans transaction error:', error);
          bot.sendMessage(userId, 'Terjadi kesalahan saat memproses deposit. Silakan coba lagi nanti.');
        });
    });
  });
});

module.exports = bot;
