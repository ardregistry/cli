import { z } from 'zod';
import axios from 'axios';
import { URL } from 'url';

// Define Zod schemas for strict network validation
export const RegistryResultSchema = z.object({
  displayName: z.string(),
  identifier: z.string(),
  type: z.string(),
  url: z.string().nullable().optional(),
  data: z.any().optional(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  version: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  score: z.number().optional(),
  source: z.string().optional(),
});

export const SearchResponseSchema = z.object({
  results: z.array(RegistryResultSchema),
  referrals: z.array(z.any()).optional(),
  pageToken: z.string().nullable().optional(),
});

export const CatalogSchema = z.object({
  capabilities: z.array(z.any()).optional(),
  entries: z.array(z.any()).optional(),
  referrals: z.array(z.object({
    url: z.string().optional(),
    domain: z.string().optional(),
  })).optional(),
});

export type RegistryResult = z.infer<typeof RegistryResultSchema>;

export interface SearchOptions {
  registry?: string;
  type?: string;
  limit?: number;
}

export interface NavigateOptions {
  depth?: number;
}

/**
 * Searches the ARD Registry for a natural language query.
 */
export async function searchRegistry(query: string, options: SearchOptions = {}): Promise<RegistryResult[]> {
  const registry = options.registry || 'https://ardregistry.org';
  const limit = options.limit || 10;
  const filterType = options.type;

  const targetUrl = `${registry.replace(/\/$/, '')}/api/search`;
  const body = {
    query: {
      text: query,
      filter: filterType ? { type: filterType } : undefined,
    },
    pageSize: limit,
  };

  const response = await axios.post(targetUrl, body, {
    headers: { 'User-Agent': 'ard-cli/1.0' },
    timeout: 5000,
  });

  try {
    const parsedResponse = SearchResponseSchema.parse(response.data);
    return parsedResponse.results;
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(`Invalid search response from registry:\n${formatZodError(e)}`);
    }
    throw e;
  }
}

/**
 * Formats a Zod schema validation error into a readable bulleted list.
 */
function formatZodError(error: z.ZodError): string {
  return error.issues.map((err) => {
    const pathStr = err.path.join('.') || 'root';
    return `- ${pathStr}: ${err.message}`;
  }).join('\n');
}

/**
 * Traverses domains recursively via client-side federation and searches locally.
 */
export async function navigateRegistry(startUrl: string, query: string, options: NavigateOptions = {}): Promise<RegistryResult[]> {
  const maxDepth = options.depth || 2;
  const visited = new Set<string>();
  const results: RegistryResult[] = [];

  async function crawl(url: string, depth: number) {
    if (depth > maxDepth || visited.has(url)) return;
    visited.add(url);

    let target = url;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`;
    }
    if (!target.endsWith('.json') && !target.endsWith('ai-catalog.json')) {
      target = `${target.replace(/\/$/, '')}/.well-known/ai-catalog.json`;
    }

    let rawCatalog: any;
    try {
      const res = await axios.get(target, {
        headers: {
          'User-Agent': 'ard-cli/1.0',
          'Accept': 'application/json',
        },
        timeout: 5000,
      });
      rawCatalog = res.data;
    } catch (e: any) {
      if (!target.includes('/.well-known/ai-catalog.json')) {
        try {
          const fallback = `${url.replace(/\/$/, '')}/.well-known/ai-catalog.json`;
          const res = await axios.get(fallback, {
            headers: {
              'User-Agent': 'ard-cli/1.0',
              'Accept': 'application/json',
            },
            timeout: 5000,
          });
          rawCatalog = res.data;
          target = fallback;
        } catch (_) {
          return;
        }
      } else {
        return;
      }
    }

    // Validate the parsed catalog using CatalogSchema
    let catalog;
    try {
      catalog = CatalogSchema.parse(rawCatalog);
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.warn(`\n⚠️  Skipping catalog at ${url} due to validation errors:\n${formatZodError(e)}\n`);
        return;
      }
      throw e;
    }
    const capabilities = catalog.capabilities || catalog.entries || [];
    let sourceDomain = 'unknown';
    try {
      sourceDomain = new URL(target).hostname;
    } catch (_) {}

    for (const item of capabilities) {
      if (matchesQuery(item, query)) {
        results.push({
          displayName: item.displayName || item.name || 'Unnamed capability',
          identifier: item.identifier || item.urn || '',
          type: item.type || 'unknown',
          url: item.url || null,
          data: item.data || null,
          description: item.description || null,
          tags: item.tags || [],
          capabilities: item.capabilities || [],
          version: item.version || null,
          updatedAt: item.updatedAt || null,
          source: sourceDomain,
        });
      }
    }

    const referrals = catalog.referrals || [];
    for (const ref of referrals) {
      const nextUrl = ref.url || ref.domain;
      if (nextUrl) {
        await crawl(nextUrl, depth + 1);
      }
    }
  }

  await crawl(startUrl, 1);
  return results;
}

export function matchesQuery(item: any, query: string): boolean {
  const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (searchTerms.length === 0) return true;

  const content = [
    item.displayName || '',
    item.name || '',
    item.description || '',
    item.identifier || '',
    item.urn || '',
    ...(item.tags || []),
    ...(item.capabilities || []),
  ].join(' ').toLowerCase();

  return searchTerms.every(term => content.includes(term));
}
