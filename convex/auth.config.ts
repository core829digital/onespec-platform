export default {
  providers: [
    {
      // Convex Auth issues tokens for this deployment; CONVEX_SITE_URL is set
      // automatically by `npx convex dev` / `convex deploy`.
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
