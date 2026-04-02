const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for panoramas
const store = new Map();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Generate unique ID
function generateId() {
    return crypto.randomBytes(6).toString('hex');
}

// Serve main page with list of existing panoramas
app.get('/', (req, res) => {
    const projects = Array.from(store.entries()).map(([id, data]) => ({
        id,
        title: data.title,
        shareUrl: `/pano/${id}`
    }));
    res.render('index', { projects });
});

// API: create new panorama
app.post('/api/create', (req, res) => {
    const { imageUrl, title } = req.body;
    
    if (!imageUrl || !title) {
        return res.status(400).json({ error: 'Image URL and title are required' });
    }
    
    try {
        new URL(imageUrl);
    } catch (e) {
        return res.status(400).json({ error: 'Invalid image URL' });
    }
    
    const id = generateId();
    store.set(id, {
        imageUrl,
        title: title.trim(),
        createdAt: new Date()
    });
    
    res.json({
        id,
        shareUrl: `/pano/${id}`,
        fullUrl: `${req.protocol}://${req.get('host')}/pano/${id}`
    });
});

// Image proxy to avoid CORS issues
app.get('/api/proxy/image', async (req, res) => {
    const imageUrl = req.query.url;
    
    if (!imageUrl) {
        return res.status(400).send('Missing image URL');
    }
    
    try {
        const parsedUrl = new URL(imageUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return res.status(400).send('Invalid protocol');
        }
        
        const response = await fetch(parsedUrl.href);
        
        if (!response.ok) {
            return res.status(response.status).send('Failed to fetch image');
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
            res.setHeader('Content-Type', contentType);
        } else {
            res.setHeader('Content-Type', 'image/jpeg');
        }
        
        // Cache for 1 hour
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
        
    } catch (err) {
        console.error('Proxy error:', err);
        res.status(500).send('Error fetching image');
    }
});

// Panorama viewer page
app.get('/pano/:id', (req, res) => {
    const { id } = req.params;
    const panorama = store.get(id);
    
    if (!panorama) {
        return res.status(404).send('Panorama not found');
    }
    
    const proxyImageUrl = `/api/proxy/image?url=${encodeURIComponent(panorama.imageUrl)}`;
    const fullUrl = `${req.protocol}://${req.get('host')}/pano/${id}`;
    
    res.render('pano', {
        title: panorama.title,
        imageProxyUrl: proxyImageUrl,
        shareUrl: fullUrl,
        id: id
    });
});

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📸 Create your first 360° panorama!`);
});