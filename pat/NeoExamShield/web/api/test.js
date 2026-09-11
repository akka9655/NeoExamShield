export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { provider, apiKey, modelName, endpoint } = req.body || {};

    if (!apiKey) return res.status(400).json({ error: 'API Key is required' });

    try {
        let apiUrl, requestBody, headers;
        
        switch (provider) {
            case 'openai':
                apiUrl = 'https://api.openai.com/v1/chat/completions';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
                requestBody = { model: modelName || 'gpt-4o-mini', messages: [{ role: 'user', content: 'Say hello' }] };
                break;
            case 'google':
                apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName || 'gemini-3.5-flash'}:generateContent?key=${apiKey}`;
                headers = { 'Content-Type': 'application/json' };
                requestBody = { contents: [{ parts: [{ text: 'Say hello' }] }] };
                break;
            case 'anthropic':
                apiUrl = 'https://api.anthropic.com/v1/messages';
                headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
                requestBody = { model: modelName || 'claude-3-5-sonnet-20240620', max_tokens: 10, messages: [{ role: 'user', content: 'Say hello' }] };
                break;
            case 'deepseek':
                apiUrl = 'https://api.deepseek.com/chat/completions';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
                requestBody = { model: modelName || 'deepseek-chat', messages: [{ role: 'user', content: 'Say hello' }] };
                break;
            case 'custom':
                if (!endpoint) return res.status(400).json({ error: 'Custom API Endpoint URL is required' });
                apiUrl = endpoint;
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
                requestBody = { model: modelName || 'default', messages: [{ role: 'user', content: 'Say hello' }] };
                break;
            default:
                return res.status(400).json({ error: 'Unsupported provider' });
        }

        const response = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestBody) });
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            return res.status(response.status).json({ 
                error: errBody.error?.message || errBody.error || `HTTP ${response.status}: ${response.statusText}` 
            });
        }
        return res.status(200).json({ success: true, message: 'API connection successful!' });
    } catch (e) {
        return res.status(500).json({ error: e.message || 'Internal connection error' });
    }
}
