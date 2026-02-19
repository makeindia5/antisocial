const express = require('express');
const router = express.Router();
const Reel = require('../models/Reel');
const User = require('../models/user');

router.get('/reel/share/:id', async (req, res) => {
    try {
        const reel = await Reel.findById(req.params.id).populate('user');

        if (!reel) {
            return res.status(404).send('Reel not found');
        }

        const appScheme = `geminifinance://social/reel/${reel._id}`;
        // Fallback to Play Store or Website if app not installed (optional)
        const fallbackUrl = 'https://play.google.com/store/apps/details?id=com.geminifinance.antisocial';

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Watch Reel on Antisocial</title>
    <meta property="og:title" content="${reel.caption || 'Check out this reel on Antisocial!'}" />
    <meta property="og:description" content="Watch this reel by ${reel.user?.name || 'User'}" />
    <meta property="og:image" content="${reel.thumbnail || 'https://via.placeholder.com/300'}" />
    <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: sans-serif; text-align: center; padding: 20px; background-color: #000; color: #fff; }
        .btn { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    </style>
</head>
<body>
    <h1>Opening in App...</h1>
    <p>If the app doesn't open automatically, click the button below.</p>
    <a href="${appScheme}" class="btn">Open in App</a>
    
    <script>
        // Attempt to open the app scheme
        window.location.href = "${appScheme}";
        
        // Optional: Redirect to fallback if app not opened after timeout
        // setTimeout(function() {
        //     window.location.href = "${fallbackUrl}";
        // }, 2000);
    </script>
</body>
</html>
        `;

        res.send(html);
    } catch (e) {
        console.error(e);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
