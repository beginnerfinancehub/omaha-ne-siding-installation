import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://omahanesidinginstall.com',
  // Network-wide convention (matches site #1 and site #2): canonical URLs
  // end with a slash (Astro 'directory' build format). One trailing-slash
  // rule across every LocalSiteLeads site.
  trailingSlash: 'always',
  integrations: [sitemap()],
});
