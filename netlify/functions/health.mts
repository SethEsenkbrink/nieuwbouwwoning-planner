import type { Config, Context } from "@netlify/functions";

/**
 * Health check — het serverside-skelet.
 *
 * Doel: bewijzen dat de Netlify Functions-pipeline werkt, lokaal (via
 * @netlify/vite-plugin) én in productie. Dit is het bestand waar de
 * documentparser straks naast komt te staan.
 *
 * Let op de moderne functievorm: web-standaard Request/Response en in-code
 * config. De oude `exports.handler = async (event)` werkt niet meer.
 *
 * Test: curl http://localhost:5173/api/health
 */
export default (_req: Request, context: Context) => {
  return Response.json(
    {
      status: "ok",
      tijd: new Date().toISOString(),
      // Handig bij het debuggen van deploys: welke deploy antwoordt er eigenlijk?
      deploy: Netlify.env.get("DEPLOY_ID") ?? "lokaal",
      regio: context.geo?.country?.code ?? null,
    },
    {
      headers: {
        // Nooit cachen: een gecachete health check zegt niets.
        "Cache-Control": "no-store",
      },
    },
  );
};

export const config: Config = {
  path: "/api/health",
};
