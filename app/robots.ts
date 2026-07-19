import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/debug/",
    },
    sitemap: "https://riichicam.com/sitemap.xml",
  };
}
