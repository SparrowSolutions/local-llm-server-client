function normalizeUrl(url) {
  return url.trim().replace(/\/+$/, '');
}

function headers(apiKey) {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (apiKey?.trim()) h.Authorization = `Bearer ${apiKey.trim()}`;
  return h;
}

async function parseError(response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data?.error?.message || data?.detail || `HTTP ${response.status}`;
  } catch {
    return text || `HTTP ${response.status}`;
  }
}

export async function fetchModels(serverUrl, apiKey) {
  const response = await fetch(`${normalizeUrl(serverUrl)}/v1/models`, {
    method: 'GET', headers: headers(apiKey),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function chat(serverUrl, apiKey, body, onToken) {
  const response = await fetch(`${normalizeUrl(serverUrl)}/v1/chat/completions`, {
    method: 'POST',
    headers: { ...headers(apiKey), Accept: body.stream ? 'text/event-stream' : 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseError(response));

  if (!body.stream) return response.json();
  if (!response.body) throw new Error('Streaming is not supported by this browser or server response.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastPayload = null;

  const consumeLine = (line) => {
    const value = line.trim();
    if (!value || !value.startsWith('data:')) return false;
    const data = value.slice(5).trim();
    if (data === '[DONE]') return true;
    try {
      const json = JSON.parse(data);
      lastPayload = json;
      const token = json?.choices?.[0]?.delta?.content;
      if (token) onToken?.(token, json);
    } catch {
      // Ignore incomplete/non-JSON SSE lines; the buffer handles chunk boundaries.
    }
    return false;
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) if (consumeLine(line)) { await reader.cancel(); return lastPayload; }
    if (done) break;
  }
  if (buffer) consumeLine(buffer);
  return lastPayload;
}
