import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, password, action } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Username is required' });
    if (!password) return res.status(400).json({ error: 'Password is required' });

    try {
        const userKey = `user:${username.toUpperCase()}`;
        let user;
        
        try {
            user = await kv.get(userKey);
        } catch (kvErr) {
            console.warn('Vercel KV warning:', kvErr.message);
            return res.status(500).json({ 
                error: 'Vercel KV Database not connected. Please connect a Storage KV database in your Vercel Dashboard (Storage -> KV).' 
            });
        }

        if (action === 'signup') {
            if (username === '000' || username === '785') {
                return res.status(400).json({ error: '000 and 785 are reserved system codes. Please choose another.' });
            }
            if (user) {
                return res.status(409).json({ error: 'Account already exists for this username. Please login.' });
            }

            // Generate a unique 3-digit code
            let staticCode;
            let attempts = 0;
            while (attempts < 50) {
                staticCode = Math.floor(100 + Math.random() * 900).toString();
                if (staticCode === '000' || staticCode === '785') continue;
                const exists = await kv.get(`code:${staticCode}`);
                if (!exists) break;
                attempts++;
            }
            
            if (attempts >= 50) return res.status(500).json({ error: 'Failed to generate unique code. System full.' });

            user = { password, staticCode, configs: [] };
            
            // Save user and the reverse lookup code
            await kv.set(userKey, user);
            await kv.set(`code:${staticCode}`, username.toUpperCase());

            return res.status(200).json({ success: true, isNew: true, user: { staticCode, configs: [] } });
        } 
        
        if (action === 'login') {
            if (!user) {
                return res.status(404).json({ error: 'Account not found. Please Sign Up first.' });
            }
            if (user.password !== password) {
                return res.status(401).json({ error: 'Incorrect password' });
            }

            return res.status(200).json({ success: true, isNew: false, user: { staticCode: user.staticCode, configs: user.configs || [] } });
        }

        return res.status(400).json({ error: 'Invalid action specified' });

    } catch (error) {
        console.error('Auth Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
