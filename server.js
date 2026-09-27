const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 8080;

// Setup Engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Halaman Utama
app.get('/', (req, res) => {
  res.render('index');
});

// API Extractor Link
app.post('/api/extract', async (req, res) => {
  try {
    const { url } = req.body;

    // Validasi input
    if (!url || !url.includes('mediafire.com')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Saat ini sistem hanya mendukung link MediaFire.' 
      });
    }

    // Mengambil halaman MediaFire
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Menggunakan Cheerio untuk mencari tombol download (ID: downloadButton)
    const $ = cheerio.load(response.data);
    const directLink = $('#downloadButton').attr('href');

    if (directLink) {
      res.json({ 
        success: true, 
        direct_link: directLink,
        message: 'Direct link berhasil ditemukan!'
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'Gagal menemukan file. Link mungkin kadaluarsa atau diproteksi.' 
      });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan pada server saat mengekstrak link.' 
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SYSTEM] Downloader Server berjalan di http://localhost:${PORT}`);
});
