import { Command } from 'commander';
import { searchRegistry, navigateRegistry } from './client';

const useColor = (process.stdout.isTTY || !!process.env.FORCE_COLOR) && !process.env.NO_COLOR;

const c = {
  reset: useColor ? '\x1b[0m' : '',
  bold: useColor ? '\x1b[1m' : '',
  dim: useColor ? '\x1b[2m' : '',
  green: useColor ? '\x1b[32m' : '',
  cyan: useColor ? '\x1b[36m' : '',
  yellow: useColor ? '\x1b[33m' : '',
  magenta: useColor ? '\x1b[35m' : '',
  red: useColor ? '\x1b[31m' : '',
};

const program = new Command();

program
  .name('ard')
  .description('The official ARD Registry CLI')
  .version('0.3.2');

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

    console.log(`\nSearching registry at ${c.cyan}${registryUrl}${c.reset} for "${c.bold}${query}${c.reset}"...\n`);

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
        let typeColor = c.cyan;
        const normalizedType = typeLabel.toLowerCase();
        if (normalizedType.includes('mcp')) typeColor = c.green;
        else if (normalizedType.includes('skill')) typeColor = c.yellow;
        else if (normalizedType.includes('agent')) typeColor = c.magenta;

        console.log(`${c.bold}${typeColor}[${typeLabel}]${c.reset} ${c.bold}${r.displayName}${c.reset}`);
        console.log(`  ${c.dim}URN:${c.reset}    ${r.identifier}`);
        console.log(`  ${c.dim}Source:${c.reset} ${c.cyan}${r.source || 'unknown'}${c.reset}`);
        if (r.score !== undefined) {
          console.log(`  ${c.dim}Score:${c.reset}  ${c.green}${r.score}%${c.reset}`);
        }
        if (r.description) {
          console.log(`  ${c.dim}Desc:${c.reset}   ${r.description}`);
        }
        console.log('');
      });
    } catch (e: any) {
      console.error(`${c.bold}${c.red}Registry search failed:${c.reset} ${e.message}`);
      process.exit(1);
    }
  });

program
  .command('navigate')
  .description('Crawl and search capability catalogs starting from a domain URL')
  .argument('<url>', 'Starting URL or domain hosting an ai-catalog.json')
  .argument('<query>', 'Local keyword filter')
  .option('-d, --depth <maxDepth>', 'Maximum crawl recursion depth', '2')
  .action(async (url, query, options) => {
    const depth = parseInt(options.depth, 10);

    console.log(`\nScanning catalog tree starting at ${c.cyan}${url}${c.reset} for "${c.bold}${query}${c.reset}" (depth limit: ${depth})...\n`);

    try {
      const results = await navigateRegistry(url, query, { depth });
      console.log(`\nScan complete. Found ${c.bold}${results.length}${c.reset} matches:\n`);

      if (results.length === 0) {
        console.log('No local matches found in catalog tree.');
        return;
      }

      results.forEach((r) => {
        const typeLabel = r.type || 'Resource';
        let typeColor = c.cyan;
        const normalizedType = typeLabel.toLowerCase();
        if (normalizedType.includes('mcp')) typeColor = c.green;
        else if (normalizedType.includes('skill')) typeColor = c.yellow;
        else if (normalizedType.includes('agent')) typeColor = c.magenta;

        console.log(`${c.bold}${typeColor}[${typeLabel}]${c.reset} ${c.bold}${r.displayName}${c.reset}`);
        console.log(`  ${c.dim}URN:${c.reset}    ${r.identifier}`);
        console.log(`  ${c.dim}Source:${c.reset} ${c.cyan}${r.source || 'local'}${c.reset}`);
        if (r.description) {
          console.log(`  ${c.dim}Desc:${c.reset}   ${r.description}`);
        }
        console.log('');
      });
    } catch (e: any) {
      console.error(`${c.bold}${c.red}Navigation crawl failed:${c.reset} ${e.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
