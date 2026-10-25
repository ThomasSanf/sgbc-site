import locations from './taiwan-locations.json';

// Chunghwa Post's bilingual administrative areas and three-digit postal prefixes.
// Source and update notes: docs/taiwan-addresses.md
export const taiwanCities = locations;
export const upcomingDeliveryCountries = ['JP', 'SG', 'FR'] as const;

export function taiwanCity(name: string) {
  return taiwanCities.find(city => city.name === name);
}

export function taiwanDistrict(city: string, district: string) {
  return taiwanCity(city)?.districts.find(item => item.name === district);
}
