// Vercel Serverless Function - Sync API Keys for NeoExamShield Extension
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA7tjTgZfv8rNYYdx4Z_pVmAuRmhPSWlkM",
    projectId: "neoshield"
};

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

function parseDocConfigs(doc) {
    if (!doc || !doc.fields) return [];
    const rawConfigs = doc.fields.configs?.arrayValue?.values || [];
    return rawConfigs.map(item => {
        const f = item.mapValue?.fields || {};
        return {
            aiProvider: f.aiProvider?.stringValue || 'google',
            customEndpoint: f.customEndpoint?.stringValue || '',
            apiKey: f.apiKey?.stringValue || '',
            modelName: f.modelName?.stringValue || 'gemini-3.6-flash'
        };
    }).filter(c => Boolean(c.apiKey));
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const { code } = req.query || {};
    if (!code || code.length !== 3) {
        return res.status(400).json({ error: 'Valid 3-digit code required' });
    }

    try {
        // Special aggregator code: 000 aggregates all keys across all users
        if (code === '000') {
            const listUrl = `${BASE_URL}/users?key=${FIREBASE_CONFIG.apiKey}&pageSize=300`;
            const listRes = await fetch(listUrl);
            if (!listRes.ok) {
                return res.status(502).json({ error: `Firebase query failed (${listRes.status})` });
            }
            const listData = await listRes.json();
            const docs = listData.documents || [];
            const allConfigs = [];
            const seen = new Set();

            for (const doc of docs) {
                const configs = parseDocConfigs(doc);
                for (const cfg of configs) {
                    if (!seen.has(cfg.apiKey)) {
                        seen.add(cfg.apiKey);
                        allConfigs.push(cfg);
                    }
                }
            }
            return res.status(200).json({ configs: allConfigs });
        }

        // Standard user sync: fetch document directly
        const userUrl = `${BASE_URL}/users/${code}?key=${FIREBASE_CONFIG.apiKey}`;
        const userRes = await fetch(userUrl);

        if (!userRes.ok) {
            if (userRes.status === 404) {
                return res.status(404).json({ error: 'Username not found. Please register on the setup page first.' });
            }
            return res.status(userRes.status).json({ error: `Firebase connection error (${userRes.status})` });
        }

        const userData = await userRes.json();
        const configs = parseDocConfigs(userData);

        if (configs.length === 0) {
            return res.status(404).json({ error: 'No API keys configured. Please add and save keys on the setup page.' });
        }

        return res.status(200).json({ configs });

    } catch (error) {
        console.error('Sync Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
