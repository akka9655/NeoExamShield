// Vercel Serverless Function - Save Configurations for NeoExamShield Setup Portal
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA7tjTgZfv8rNYYdx4Z_pVmAuRmhPSWlkM",
    projectId: "neoshield"
};

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, password, newPassword, configs } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ error: 'Authentication required' });
    }

    try {
        const userUrl = `${BASE_URL}/users/${username}?key=${FIREBASE_CONFIG.apiKey}`;

        // Verify existing user password first
        const userRes = await fetch(userUrl);
        if (userRes.status === 404) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!userRes.ok) {
            return res.status(userRes.status).json({ error: `Firebase error (${userRes.status})` });
        }

        const docData = await userRes.json();
        const storedPassword = docData.fields?.password?.stringValue;
        if (storedPassword !== password) {
            return res.status(401).json({ error: 'Unauthorized: Incorrect password' });
        }

        // Prepare PATCH payload with updateMask
        const validConfigs = (configs || []).filter(c => c && c.apiKey && c.apiKey.trim().length > 0);
        let maskParams = 'updateMask.fieldPaths=configs&updateMask.fieldPaths=updatedAt';

        const updateFields = {
            configs: {
                arrayValue: {
                    values: validConfigs.map(c => ({
                        mapValue: {
                            fields: {
                                aiProvider: { stringValue: c.aiProvider || 'google' },
                                apiKey: { stringValue: c.apiKey.trim() },
                                modelName: { stringValue: c.modelName || 'gemini-3.6-flash' },
                                customEndpoint: { stringValue: c.customEndpoint || '' }
                            }
                        }
                    }))
                }
            },
            updatedAt: { timestampValue: new Date().toISOString() }
        };

        if (newPassword && newPassword.trim().length > 0) {
            maskParams += '&updateMask.fieldPaths=password';
            updateFields.password = { stringValue: newPassword.trim() };
        }

        const patchUrl = `${BASE_URL}/users/${username}?${maskParams}&key=${FIREBASE_CONFIG.apiKey}`;
        const patchRes = await fetch(patchUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: updateFields })
        });

        if (!patchRes.ok) {
            const errData = await patchRes.json().catch(() => ({}));
            return res.status(500).json({ error: errData.error?.message || 'Failed to update user settings' });
        }

        return res.status(200).json({ success: true, message: 'Settings saved successfully' });

    } catch (error) {
        console.error('Save Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
