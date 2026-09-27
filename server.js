const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 8080;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.render('index');
});

// API Multi-Bypass Extractor
app.post('/api/extract', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ success: false, message: 'URL tidak valid. Harus diawali http/https.' });
    }

    let directLink = null;
    let bypassType = 'UNKNOWN';

    // 1. CEK SAFELINK BASE64 (Mencari payload 'aHR0c' yang merupakan 'http' dalam base64)
    try {
      const urlObj = new URL(url);
      for (const [key, value] of urlObj.searchParams) {
        if (value.startsWith('aHR0c')) { // 'aHR0c' = 'http'
          const decoded = Buffer.from(value, 'base64').toString('utf8');
          if (decoded.startsWith('http')) {
            directLink = decoded;
            bypassType = 'SAFELINK BASE64 DECODER';
            break;
          }
        }
      }
    } catch (e) { /* Abaikan jika bukan URL yang valid */ }

    // 2. MEDIAFIRE EXTRACTOR
    if (!directLink && url.includes('mediafire.com')) {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const $ = cheerio.load(response.data);
      const mfLink = $('#downloadButton').attr('href');
      if (mfLink) {
        directLink = mfLink;
        bypassType = 'MEDIAFIRE ENGINE';
      }
    }

    // 3. GENERIC SHORTLINK REDIRECT TRACKER (bit.ly, s.id, tinyurl, dll)
    if (!directLink) {
      try {
        // Jangan ikuti redirect (maxRedirects: 0), tangkap URL tujuannya di header
        const response = await axios.get(url, {
          maxRedirects: 0,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        // Cek Meta Refresh tag jika web menggunakan redirect HTML alih-alih HTTP Header
        const $ = cheerio.load(response.data);
        const refresh = $('meta[http-equiv="refresh"]').attr('content');
        if (refresh) {
          const match = refresh.match(/url=['"]?(.*?)['"]?$/i);
          if (match) {
            directLink = match[1];
            bypassType = 'META REFRESH TRACKER';
          }
        }
      } catch (err) {
        // Tangkap Header Location (Status 301/302 Redirect)
        if (err.response && err.response.status >= 300 && err.response.status < 400) {
          directLink = err.response.headers.location;
          bypassType = 'HTTP 301/302 REDIRECT TRACKER';
        }
      }
    }

    // FINAL RESPONSE
    if (directLink) {
      res.json({ 
        success: true, 
        direct_link: directLink,
        type: bypassType,
        message: 'Bypass berhasil dieksekusi!'
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'Gagal menembus link. Server dilindungi proteksi tinggi atau file dihapus.' 
      });
    }

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Node.js mengalami kendala saat routing.' });
  }
});

// Ekspor untuk Vercel / Listen lokal Termux
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SYSTEM] Universal Bypasser Running on http://localhost:${PORT}`);
  });
}
module.exports = app;
