const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function getPlatforms(region) {
  const params = region ? `?region=${region}` : '';
  const response = await fetch(`${API_BASE_URL}/api/platforms${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch platforms');
  }
  return response.json();
}

export async function getRegion() {
  const response = await fetch(`${API_BASE_URL}/api/region`);
  if (!response.ok) {
    throw new Error('Failed to detect region');
  }
  return response.json();
}

export async function sendChatMessage({ message, platforms, region, conversationHistory }) {
  const response = await fetch(`${API_BASE_URL}/api/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, platforms, region, conversationHistory }),
  });
  if (!response.ok) {
    throw new Error('Failed to get recommendations');
  }
  return response.json();
}

export async function sendGuidedRecommendation({ tags, platforms, region }) {
  const response = await fetch(`${API_BASE_URL}/api/recommend/guided`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags, platforms, region }),
  });
  if (!response.ok) {
    throw new Error('Failed to get guided recommendations');
  }
  return response.json();
}

export async function getRecommendations(platformIds, region) {
  const params = new URLSearchParams();
  if (platformIds && platformIds.length > 0) {
    params.set('platforms', platformIds.join(','));
  }
  if (region) {
    params.set('region', region);
  }
  const response = await fetch(`${API_BASE_URL}/api/recommendations?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch recommendations');
  }
  return response.json();
}
