// Vercel Serverless Function - Auth for NeoExamShield Setup Portal
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA7tjTgZfv8rNYYdx4Z_pVmAuRmhPSWlkM",
    projectId: "neoshield"
};

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

function parseDoc(doc) {
    if (!doc || !doc.fields) return null;
    const f = doc.fields;
    const rawConfigs = f.configs?.arrayValue?.values || [];
    const configs = rawConfigs.map(item => {
        const cf = item.mapValue?.fields || {};
        return {
            aiProvider: cf.aiProvider?.stringValue || 'google',
            customEndpoint: cf.customEndpoint?.stringValue || '',
            apiKey: cf.apiKey?.stringValue || '',
            modelName: cf.modelName?.stringValue || 'gemini-3.6-flash'
        };
    }).filter(c => Boolean(c.apiKey));

    return {
        password: f.password?.stringValue || '',
        staticCode: f.staticCode?.stringValue || '',
        configs
    };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, password, action } = req.body || {};
    if (!username || !/^[0-9]{3}$/.test(username)) {
        return res.status(400).json({ error: 'Valid 3-digit username required' });
    }
    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    try {
        const userUrl = `${BASE_URL}/users/${username}?key=${FIREBASE_CONFIG.apiKey}`;

        if (action === 'signup') {
            if (username === '000' || username === '785') {
                return res.status(400).json({ error: '000 and 785 are reserved system codes. Please choose another.' });
            }

            // Check if document already exists
            const checkRes = await fetch(userUrl);
            if (checkRes.ok) {
                return res.status(409).json({ error: 'Account already exists for this username. Please login.' });
            }

            // Create user document via Firestore REST PATCH
            const createPayload = {
                fields: {
                    password: { stringValue: password },
                    staticCode: { stringValue: username },
                    configs: { arrayValue: { values: [] } },
                    createdAt: { timestampValue: new Date().toISOString() }
                }
            };

            const createRes = await fetch(userUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createPayload)
            });

            if (!createRes.ok) {
                const errData = await createRes.json().catch(() => ({}));
                return res.status(500).json({ error: errData.error?.message || 'Failed to create user account' });
            }

            return res.status(200).json({
                success: true,
                isNew: true,
                user: { staticCode: username, configs: [] }
            });
        }

        if (action === 'login') {
            const getRes = await fetch(userUrl);
            if (getRes.status === 404) {
                return res.status(404).json({ error: 'Account not found. Please Sign Up first.' });
            }
            if (!getRes.ok) {
                return res.status(getRes.status).json({ error: `Firebase connection error (${getRes.status})` });
            }

            const docData = await getRes.json();
            const user = parseDoc(docData);

            if (!user || user.password !== password) {
                return res.status(401).json({ error: 'Incorrect password' });
            }

            return res.status(200).json({
                success: true,
                isNew: false,
                user: { staticCode: user.staticCode || username, configs: user.configs || [] }
            });
        }

        return res.status(400).json({ error: 'Invalid action specified' });

    } catch (error) {
        console.error('Auth Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
