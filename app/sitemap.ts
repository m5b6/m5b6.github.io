import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/apps/discovery";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(new Date());
}
