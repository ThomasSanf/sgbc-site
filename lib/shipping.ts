export const deliveryCountries = ['TW', 'JP', 'SG'] as const;
export type DeliveryCountry = typeof deliveryCountries[number];

export const postalCodePatterns: Record<DeliveryCountry, string> = {
  TW: '[0-9]{3}([0-9]{2,3})?',
  JP: '[0-9]{3}-?[0-9]{4}',
  SG: '[0-9]{6}',
};

// The existing fee is a Taiwan rate. International rates are not yet configured;
// sandbox checkout can reuse the test amount without enabling real overseas sales.
export function deliveryFeePerUnit(country: DeliveryCountry, taiwanFee: number | null, sandbox: boolean) {
  return country === 'TW' || sandbox ? taiwanFee : null;
}
