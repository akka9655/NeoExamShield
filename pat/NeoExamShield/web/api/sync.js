import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const { code } = req.query || {};
    if (!code || code.length !== 3) return res.status(400).json({ error: 'Valid 3-digit code required' });

    try {
        let username;
        try {
            username = await kv.get(`code:${code}`);
        } catch (kvErr) {
            console.warn('Vercel KV warning:', kvErr.message);
            return res.status(500).json({ 
                error: 'Vercel KV Database not connected. Please connect a Storage KV database in your Vercel Dashboard.' 
            });
        }

        if (!username) {
            return res.status(404).json({ error: 'Invalid or unregistered code' });
        }

        // Fetch the user's configurations
        const user = await kv.get(`user:${username}`);
        
        if (!user || !user.configs || user.configs.length === 0) {
            return res.status(404).json({ error: 'No API keys configured for this code' });
        }

        // Return the configs (without password or sensitive account info)
        return res.status(200).json({ configs: user.configs });
    } catch (error) {
        console.error('Sync Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
