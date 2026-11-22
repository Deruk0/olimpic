const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const configuredUrl = process.env.OLIMPIK_SITE_URL || (productionHost && `https://${productionHost}`);

export const siteUrl = configuredUrl ? new URL(configuredUrl) : undefined;
