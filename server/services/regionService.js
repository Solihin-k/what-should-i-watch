import axios from 'axios';

const SUPPORTED_REGIONS = {
  SG: 'Singapore',
  MY: 'Malaysia',
  ID: 'Indonesia',
  TH: 'Thailand',
  PH: 'Philippines',
};

async function detectRegion(ip) {
  // Default to Singapore for localhost development traffic
  const localhostAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  if (!ip || localhostAddresses.includes(ip)) {
    return { countryCode: 'SG', countryName: 'Singapore' };
  }

  try {
    const response = await axios.get(`${process.env.IPAPI_BASE_URL}/${ip}/json/`);
    const { country_code, country_name } = response.data;
    return {
      countryCode: country_code || 'SG',
      countryName: country_name || 'Singapore',
    };
  } catch {
    // Fall back to Singapore if geolocation fails
    return { countryCode: 'SG', countryName: 'Singapore' };
  }
}

export { detectRegion, SUPPORTED_REGIONS };
