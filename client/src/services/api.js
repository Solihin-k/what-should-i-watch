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
