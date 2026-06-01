/** Merchant API ProductInput shape (REST JSON). */
export type GoogleMerchantProductInput = {
  offerId: string;
  contentLanguage: string;
  feedLabel: string;
  productAttributes: GoogleMerchantProductAttributes;
};

export type GoogleMerchantProductAttributes = {
  title: string;
  description: string;
  link: string;
  imageLink: string;
  availability: "IN_STOCK" | "OUT_OF_STOCK";
  condition: "NEW";
  brand: string;
  identifierExists: boolean;
  mpn: string;
  googleProductCategory?: string;
  price: {
    amountMicros: string;
    currencyCode: "USD";
  };
  shipping?: Array<{
    country: string;
    price: {
      amountMicros: string;
      currencyCode: "USD";
    };
  }>;
};

export type GoogleMerchantInsertResponse = {
  name?: string;
  product?: string;
  offerId?: string;
  error?: { message?: string };
};

export type GoogleMerchantProductResponse = {
  name?: string;
  productStatus?: {
    destinationStatuses?: Array<{
      reportingContext?: string;
      approvedCountries?: string[];
      disapprovedCountries?: string[];
    }>;
  };
};
