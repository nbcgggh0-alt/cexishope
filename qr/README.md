# 📱 QR Code Pembayaran / Payment QR Code

## 🔧 Cara Tukar QR Code (For Admin)

### Langkah 1: Sediakan QR Code Anda
1. Dapatkan QR code pembayaran dari bank/e-wallet anda
2. Save sebagai gambar (format: JPG, PNG, atau JPEG)
3. Pastikan gambar jelas dan boleh di-scan

### Langkah 2: Upload QR Code
1. Gantikan file `payment-qr.jpg` dalam folder `qr/` dengan QR code anda
2. Atau simpan dengan nama lain, contoh: `my-qr.jpg`

### Langkah 3: Update Settings (Jika Guna Nama Lain)
Jika anda guna nama file lain, update dalam `data/settings.json`:

```json
"qrPayment": {
  "path": "./qr/my-qr.jpg",
  ...
}
```

### Langkah 4: Restart Bot
Bot akan auto-restart bila ada perubahan. QR code baru akan dihantar kepada pembeli!

---

## 📝 Nota Penting

- **Size gambar yang disarankan**: Maksimum 5MB
- **Format yang disokong**: JPG, PNG, JPEG
- **QR code semasa**: Sample sahaja untuk testing
- **⚠️ PENTING**: Tukar dengan QR code SEBENAR anda sebelum terima pembayaran!

---

## 🎯 Fungsi QR Code

QR code akan dihantar secara automatik kepada pembeli bila:
1. Pembeli buat order baru
2. Pembeli akan terima mesej dengan QR code sebagai gambar
3. Pembeli boleh scan terus untuk bayar
4. Pembeli boleh hantar bukti pembayaran melalui live chat atau `/send` command

---

## 💡 Tips

- Pastikan QR code tidak expired (untuk DuitNow QR yang dynamic)
- Test QR code dengan scan dulu sebelum guna
- Kalau guna Static QR, pembeli kena masukkan amount sendiri
- Kalau guna Dynamic QR dengan amount tetap, lebih mudah untuk pembeli

---

## 🆘 Sokongan

Jika ada masalah:
1. Pastikan path dalam `settings.json` betul
2. Pastikan file exists dalam folder `qr/`
3. Restart bot: Tekan Ctrl+C dan run semula
4. Check logs untuk error messages
