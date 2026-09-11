import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, password, newPassword, configs } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Authentication required' });

    try {
        const userKey = `user:${username.toUpperCase()}`;
        let user;

        try {
            user = await kv.get(userKey);
        } catch (kvErr) {
            console.warn('Vercel KV warning:', kvErr.message);
            return res.status(500).json({ 
                error: 'Vercel KV Database not connected. Please connect a Storage KV database in your Vercel Dashboard.' 
            });
        }

        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Unauthorized: Incorrect password' });
        }

        // Update configurations
        if (configs) {
            user.configs = configs;
        }

        // Update password if requested
        if (newPassword && newPassword.trim().length > 0) {
            user.password = newPassword.trim();
        }

        await kv.set(userKey, user);

        return res.status(200).json({ success: true, message: 'Settings saved successfully' });
    } catch (error) {
        console.error('Save Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
