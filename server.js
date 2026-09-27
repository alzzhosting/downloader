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

// API Multi-Bypass & Deep Extractor
app.post('/api/extract', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ success: false, message: 'URL tidak valid. Harus diawali http/https.' });
    }

    let directLink = null;
    let bypassType = 'UNKNOWN';

    // 1. CEK PARAMETER URL BASE64 (Safelink Standard)
    try {
      const urlObj = new URL(url);
      for (const [key, value] of urlObj.searchParams) {
        if (value.startsWith('aHR0c')) { // 'aHR0c' = 'http' dalam base64
          const decoded = Buffer.from(value, 'base64').toString('utf8');
          if (decoded.startsWith('http')) {
            directLink = decoded;
            bypassType = 'URL PARAM BASE64 DECODER';
          }
        }
      }
    } catch (e) {}

    // JIKA BELUM KETEMU, LAKUKAN DEEP SCAN KE HALAMAN TARGET
    if (!directLink) {
      try {
        const response = await axios.get(url, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          timeout: 10000 // Batas waktu 10 detik
        });
        
        const html = response.data;
        const finalUrl = response.request.res.responseUrl;

        // 2. CEK AUTO-REDIRECT AXIOS (Untuk bit.ly / s.id)
        if (finalUrl && finalUrl !== url && !finalUrl.includes('sfl.gl') && !finalUrl.includes('safelink')) {
          directLink = finalUrl;
          bypassType = 'HTTP REDIRECT TRACKER';
        }

        // 3. MEDIAFIRE EXTRACTOR
        if (!directLink && (url.includes('mediafire.com') || finalUrl.includes('mediafire.com'))) {
          const $ = cheerio.load(html);
          const mfLink = $('#downloadButton').attr('href');
          if (mfLink) {
            directLink = mfLink;
            bypassType = 'MEDIAFIRE ENGINE';
          }
        }

        // 4. DEEP SCAN BASE64 (SANGAT AMPUH UNTUK sfl.gl / SafelinkU)
        // Mencari string apa pun di dalam HTML yang dimulai dengan 'aHR0c' (enkripsi http)
        if (!directLink) {
          const b64Links = html.match(/aHR0c[A-Za-z0-9+/=]+/g);
          if (b64Links) {
            for (let b64 of b64Links) {
              try {
                let dec = Buffer.from(b64, 'base64').toString('utf8');
                // Pastikan hasil dekripsi adalah URL dan bukan link balik ke sfl.gl
                if (dec.startsWith('http') && !dec.includes('sfl.gl')) {
                  directLink = dec;
                  bypassType = 'DEEP SCAN BASE64 EXTRACTOR';
                  break; // Hentikan pencarian jika sudah ketemu
                }
              } catch(e) { /* Lanjut jika gagal decode */ }
            }
          }
        }

        // 5. META REFRESH TRACKER
        if (!directLink) {
          const $ = cheerio.load(html);
          const refresh = $('meta[http-equiv="refresh"]').attr('content');
          if (refresh) {
            const match = refresh.match(/url=['"]?(.*?)['"]?$/i);
            if (match && match[1].startsWith('http')) {
              directLink = match[1];
              bypassType = 'META REFRESH TRACKER';
            }
          }
        }

      } catch (err) {
        // 6. TANGKAP HARD REDIRECT (301/302) JIKA AXIOS ERROR
        if (err.response && err.response.headers && err.response.headers.location) {
          directLink = err.response.headers.location;
          bypassType = 'HTTP 301/302 REDIRECT TRACKER';
        }
      }
    }

    // FINAL RESPONSE
    if (directLink) {
      res.json({ success: true, direct_link: directLink, type: bypassType, message: 'Bypass berhasil!' });
    } else {
      res.status(404).json({ success: false, message: 'Gagal menembus. Web menggunakan Captcha / JS Anti-Bot level tinggi.' });
    }

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Node.js mengalami error.' });
  }
});

// Ekspor untuk Vercel / Listen lokal
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SYSTEM] Universal Bypasser Running on http://localhost:${PORT}`);
  });
}
module.exports = app;
