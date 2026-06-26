import { Command } from 'commander';
import { searchRegistry, navigateRegistry } from './client';

const program = new Command();

program
  .name('ard')
  .description('ARD Registry Client CLI tool')
  .version('0.1.0');

program
  .command('search')
  .description('Query the public registry by natural language intent')
  .argument('<query>', 'Natural language query (e.g. "weather data")')
  .option('-r, --registry <url>', 'Registry endpoint URL', 'https://ardregistry.org')
  .option('-t, --type <type>', 'Filter by type (e.g., mcp_server, skill)')
  .option('-l, --limit <limit>', 'Maximum results count', '10')
  .action(async (query, options) => {
    const registryUrl = options.registry;
    const filterType = options.type;
    const limit = parseInt(options.limit, 10);

    console.log(`\nSearching registry at ${registryUrl} for "${query}"...\n`);

    try {
      const results = await searchRegistry(query, {
        registry: registryUrl,
        type: filterType,
        limit: limit,
      });

      if (results.length === 0) {
        console.log('No results found.');
        return;
      }

      results.forEach((r) => {
        const typeLabel = r.type || 'Resource';
        console.log(`[${typeLabel}] ${r.displayName}`);
        console.log(`  URN:    ${r.identifier}`);
        console.log(`  Source: ${r.source}`);
        console.log(`  Score:  ${r.score}%`);
        if (r.description) {
          console.log(`  Desc:   ${r.description}`);
        }
        console.log('');
      });
    } catch (e: any) {
      console.error(`Registry search failed: ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('navigate')
  .description('Perform local federated navigation starting from a catalog URL')
  .argument('<url>', 'Starting URL or domain hosting an ai-catalog.json')
  .argument('<query>', 'Local keyword filter')
  .option('-d, --depth <maxDepth>', 'Maximum crawl recursion depth', '2')
  .action(async (url, query, options) => {
    const depth = parseInt(options.depth, 10);

    console.log(`\nRunning local federated navigation starting at ${url} for "${query}" (depth limit: ${depth})...\n`);

    try {
      const results = await navigateRegistry(url, query, { depth });
      console.log(`\nFederated search complete. Found ${results.length} matches:\n`);

      if (results.length === 0) {
        console.log('No local matches found in catalog tree.');
        return;
      }

      results.forEach((r) => {
        const typeLabel = r.type || 'Resource';
        console.log(`[${typeLabel}] ${r.displayName}`);
        console.log(`  URN:    ${r.identifier}`);
        console.log(`  Source: ${r.source}`);
        if (r.description) {
          console.log(`  Desc:   ${r.description}`);
        }
        console.log('');
      });
    } catch (e: any) {
      console.error(`Navigation crawl failed: ${e.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
