import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServer } from 'http';
import { exec } from 'child_process';
import axios from 'axios';
import { matchesQuery, RegistryResultSchema, CatalogSchema, searchRegistry, navigateRegistry } from '../src/client';

vi.mock('axios');

describe('CLI Client Library Tests', () => {
  describe('matchesQuery utility', () => {
    const mockItem = {
      displayName: 'Weather Station Tool',
      name: 'weather_station',
      description: 'Provides live meteorological details and forecast readings.',
      identifier: 'urn:ai:weather.org:mcp:weather',
      tags: ['weather', 'climate', 'api'],
      capabilities: ['get-temperature', 'get-humidity'],
    };

    it('should match terms matching name, displayName, description, tags, or capabilities', () => {
      expect(matchesQuery(mockItem, 'weather')).toBe(true);
      expect(matchesQuery(mockItem, 'meteorological details')).toBe(true);
      expect(matchesQuery(mockItem, 'climate')).toBe(true);
      expect(matchesQuery(mockItem, 'get-temperature')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(matchesQuery(mockItem, 'WEATHER')).toBe(true);
      expect(matchesQuery(mockItem, 'METEOROLOGICAL')).toBe(true);
    });

    it('should perform AND logic across multiple whitespace-separated terms', () => {
      expect(matchesQuery(mockItem, 'weather live temperature')).toBe(true);
      expect(matchesQuery(mockItem, 'weather invalid')).toBe(false);
    });

    it('should return true for empty queries', () => {
      expect(matchesQuery(mockItem, '')).toBe(true);
      expect(matchesQuery(mockItem, '   ')).toBe(true);
    });
  });

  describe('Schemas', () => {
    it('should validate standard RegistryResultSchema shapes', () => {
      const payload = {
        displayName: 'Station',
        identifier: 'urn:ai:station',
        type: 'mcp_server',
        description: 'Mock',
        tags: ['test'],
        score: 95,
        source: 'domain.com',
      };
      expect(RegistryResultSchema.safeParse(payload).success).toBe(true);
    });

    it('should fail RegistryResultSchema if displayName or identifier are missing', () => {
      const payload = {
        type: 'mcp_server',
      };
      expect(RegistryResultSchema.safeParse(payload).success).toBe(false);
    });

    it('should parse CatalogSchema structures', () => {
      const payload = {
        capabilities: [
          { name: 'cap1' }
        ],
        referrals: [
          { url: 'https://domain.com' },
          { domain: 'another.com' }
        ]
      };
      expect(CatalogSchema.safeParse(payload).success).toBe(true);
    });
  });

  describe('searchRegistry library method', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should call the correct endpoint with formatted body and return results', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              displayName: 'Weather Station Tool',
              identifier: 'urn:ai:weather.org:mcp:weather',
              type: 'mcp_server',
              source: 'weather.org',
              score: 98,
              description: 'Provides live details.',
            }
          ]
        }
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const results = await searchRegistry('weather station', {
        registry: 'https://test-registry.local',
        type: 'mcp_server',
        limit: 5,
      });

      expect(axios.post).toHaveBeenCalledWith(
        'https://test-registry.local/api/search',
        {
          query: {
            text: 'weather station',
            filter: { type: 'mcp_server' },
          },
          pageSize: 5,
        },
        {
          headers: { 'User-Agent': 'ard-cli/1.0' },
          timeout: 5000,
        }
      );

      expect(results).toHaveLength(1);
      expect(results[0].displayName).toBe('Weather Station Tool');
      expect(results[0].score).toBe(98);
    });
  });

  describe('navigateRegistry library method', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should fetch catalog, match queries, and recurse referrals', async () => {
      const mockCatalog = {
        capabilities: [
          {
            displayName: 'Local Weather Tool',
            identifier: 'urn:ai:weather',
            type: 'skill',
          }
        ],
        referrals: [
          { url: 'https://another-catalog.local/ai-catalog.json' }
        ]
      };

      const mockReferralCatalog = {
        capabilities: [
          {
            displayName: 'Remote Weather Agent',
            identifier: 'urn:ai:agent',
            type: 'a2a_agent',
          }
        ]
      };

      vi.mocked(axios.get).mockImplementation(async (url: string) => {
        if (url.includes('another-catalog.local')) {
          return { data: mockReferralCatalog } as any;
        }
        return { data: mockCatalog } as any;
      });

      const results = await navigateRegistry('https://start.local', 'weather', { depth: 2 });

      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0].displayName).toBe('Local Weather Tool');
      expect(results[1].displayName).toBe('Remote Weather Agent');
    });
  });

  describe('CLI Binary End-to-End Command execution', () => {
    function runCliAsync(command: string): Promise<string> {
      return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || stdout || error.message));
          } else {
            resolve(stdout);
          }
        });
      });
    }

    it('should print search results when executing CLI bin search against a local HTTP mock server', async () => {
      const mockResponse = {
        results: [
          {
            displayName: 'Weather Service',
            identifier: 'urn:ai:weather',
            type: 'mcp_server',
            source: 'weather.org',
            score: 95,
            description: 'Local temperature info.'
          }
        ]
      };

      let receivedBody = '';
      const server = createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/api/search') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', () => {
            receivedBody = body;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(mockResponse));
          });
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 3005;

      try {
        const output = await runCliAsync(
          `node bin/cli.js search "weather station" -r http://127.0.0.1:${port}`
        );

        const parsedBody = JSON.parse(receivedBody);
        expect(parsedBody.query.text).toBe('weather station');

        expect(output).toContain('Searching registry at http://127.0.0.1:');
        expect(output).toContain('[mcp_server] Weather Service');
        expect(output).toContain('URN:    urn:ai:weather');
        expect(output).toContain('Source: weather.org');
        expect(output).toContain('Score:  95%');
        expect(output).toContain('Desc:   Local temperature info.');
      } finally {
        server.close();
      }
    });

    it('should print local catalog match results when executing CLI bin navigate against a local catalog server', async () => {
      const mockCatalog = {
        capabilities: [
          {
            displayName: 'Federated Search Skill',
            identifier: 'urn:ai:search-skill',
            type: 'skill',
            description: 'A skill for testing navigation'
          }
        ]
      };

      const server = createServer((req, res) => {
        if (req.url === '/.well-known/ai-catalog.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(mockCatalog));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 3005;

      try {
        const output = await runCliAsync(
          `node bin/cli.js navigate http://127.0.0.1:${port} "federated"`
        );

        expect(output).toContain(`Running local federated navigation starting at http://127.0.0.1:${port}`);
        expect(output).toContain('[skill] Federated Search Skill');
        expect(output).toContain('URN:    urn:ai:search-skill');
        expect(output).toContain('Desc:   A skill for testing navigation');
      } finally {
        server.close();
      }
    });
  });
});
