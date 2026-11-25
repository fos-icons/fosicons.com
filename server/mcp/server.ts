import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  CATEGORIES, FRAMEWORKS, SITE, STYLES, UnknownIconError, checkIconNames, frameworkSetup, iconCode, libraryStats, listIcons,
  searchIcons,
} from './icons.js';

export const SERVER_NAME = 'fos-icons';
export const SERVER_VERSION = '0.1.0';

const stats = libraryStats();

export const INSTRUCTIONS = `Fos Icons: ${stats.icons.toLocaleString('en-US')} ${stats.license} icons in four styles (regular, filled, duocolor, duotone), with packages for React, Vue, Svelte, SolidJS, Angular and Flutter. ${SITE}

Rules:
- Never guess or invent an icon name. Find icons with search_icons, and run check_icon_names on any name you didn't get from these tools (including names already in the user's code).
- Never hand-draw or rewrite icon SVG paths. Use the package component, or the SVG that get_icon_code returns.
- Get imports and usage from get_icon_code, and package setup from get_framework_setup. Only @fos-icons/react and @fos-icons/vue are on npm; the other packages install from a local build.
- Default to the regular style. Keep one style across a UI unless the user asks otherwise. The website calls the filled style "Solid"; code always uses the Filled suffix.
- If a project already uses another icon library, keep using it unless the user asks to switch.`;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const style = z.enum(STYLES);
const framework = z.enum(FRAMEWORKS);
const category = z.enum(CATEGORIES as [string, ...string[]]);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB hex color');

/* Output schemas: what each tool's structuredContent holds. The SDK checks every result against them. */
const iconSummary = z.object({
  name: z.string().describe('Canonical icon name'),
  category: z.string(),
  tags: z.array(z.string()),
  components: z.record(style, z.string()).describe('Component name per style, the same in every component framework'),
  url: z.string().describe('Icon page on fosicons.com'),
});
const SEARCH_OUTPUT = {
  results: z.array(z.object({
    query: z.string(),
    total: z.number().int().describe('Matches before the limit'),
    icons: z.array(iconSummary),
    suggestions: z.array(z.string()).optional().describe('Close matches, only when nothing matched'),
  })),
};
const CODE_OUTPUT = {
  name: z.string(),
  style,
  framework,
  package: z.string(),
  install: z.string().describe('Install command or steps'),
  identifier: z.string().describe('Component name, Flutter constant, or SVG file path'),
  code: z.string().describe('Import and usage example'),
  svg: z.string().optional().describe('Inline Regular SVG markup, framework "svg" only'),
  url: z.string(),
  docs: z.string(),
  notes: z.array(z.string()),
};
const CHECK_OUTPUT = {
  checks: z.array(z.object({
    input: z.string(),
    valid: z.boolean(),
    name: z.string().optional(),
    style: style.optional(),
    suggestions: z.array(z.string()).optional(),
  })),
};
const LIST_OUTPUT = {
  category: z.string().nullable(),
  total: z.number().int(),
  offset: z.number().int(),
  icons: z.array(iconSummary),
  nextOffset: z.number().int().nullable().describe('Offset of the next page, or null after the last'),
  categories: z.array(z.object({ name: z.string(), count: z.number().int() })),
};
const SETUP_OUTPUT = {
  framework,
  package: z.string(),
  published: z.boolean().describe('False until the package is on its registry'),
  install: z.string(),
  naming: z.string(),
  props: z.string(),
  example: z.string(),
  accessibility: z.string(),
  docs: z.string(),
};

function result(data: object, text?: string): CallToolResult {
  return {
    content: [{ type: 'text', text: text ?? JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

function failure(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** A logger the HTTP entry point can swap; tests pass a no-op. */
export type ToolLogger = (event: Record<string, unknown>) => void;

/** One server per request: the endpoint is stateless and read-only. */
export function createServer(log: ToolLogger = () => {}): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME, version: SERVER_VERSION, title: 'Fos Icons', websiteUrl: SITE,
      icons: [{ src: `${SITE}/favicon.svg`, mimeType: 'image/svg+xml' }],
    },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool('search_icons', {
    title: 'Search icons',
    description:
      'Find Fos Icons by name, tag, synonym or meaning. Pass several queries at once (one per UI element) to resolve a whole screen in one call. Every word of a query must match; when nothing does, close matches are returned as suggestions. Returns canonical names and the component name for each style.',
    inputSchema: {
      queries: z.array(z.string().trim().min(1).max(80)).min(1).max(20).describe('Search phrases, such as ["settings", "user profile", "trash"]'),
      category: category.optional().describe('Only search this category'),
      limit: z.number().int().min(1).max(50).default(8).describe('Results per query'),
    },
    outputSchema: SEARCH_OUTPUT,
    annotations: { title: 'Search icons', ...READ_ONLY },
  }, ({ queries, category, limit }) => {
    const results = searchIcons(queries, { category, limit });
    const misses = results.filter((r) => !r.total).map((r) => r.query.slice(0, 60));
    log({ tool: 'search_icons', queries: queries.length, misses });
    return result({ results });
  });

  server.registerTool('get_icon_code', {
    title: 'Get icon code',
    description:
      'Exact install command, import and usage code for one icon in one framework and style. framework "svg" returns plain SVG/HTML usage, and the inline SVG markup for the regular style. Accepts canonical names (fuel-pump) or component names (FuelPumpRegular).',
    inputSchema: {
      name: z.string().trim().min(1).max(100).describe('Icon name from search_icons'),
      framework: framework.describe('Target framework, or "svg" for plain SVG and HTML'),
      style: style.optional().describe('Defaults to regular, or to the style in a component name'),
      size: z.number().int().min(8).max(512).optional().describe('Pixel size, default 24'),
      color: hex.optional().describe('Regular and filled: icon color. Omit to inherit currentColor.'),
      primaryColor: hex.optional().describe('Duocolor and duotone: main color'),
      secondaryColor: hex.optional().describe('Duocolor: accent color'),
    },
    outputSchema: CODE_OUTPUT,
    annotations: { title: 'Get icon code', ...READ_ONLY },
  }, ({ name, framework, ...options }) => {
    try {
      const code = iconCode(name, framework, options);
      log({ tool: 'get_icon_code', framework, style: code.style });
      return result({ ...code });
    } catch (error) {
      if (error instanceof UnknownIconError) {
        log({ tool: 'get_icon_code', framework, unknown: name.slice(0, 60) });
        return failure(error.message);
      }
      throw error;
    }
  });

  server.registerTool('check_icon_names', {
    title: 'Check icon names',
    description:
      'Check that icon names exist before using them in code, for example names written from memory or found in existing code. Accepts canonical names, component names (FuelPumpRegular) and Flutter constants. Invalid names come back with the closest real icons.',
    inputSchema: {
      names: z.array(z.string().trim().min(1).max(100)).min(1).max(100),
    },
    outputSchema: CHECK_OUTPUT,
    annotations: { title: 'Check icon names', ...READ_ONLY },
  }, ({ names }) => {
    const checks = checkIconNames(names);
    log({ tool: 'check_icon_names', names: names.length, invalid: checks.filter((c) => !c.valid).length });
    return result({ checks });
  });

  server.registerTool('list_icons', {
    title: 'List icons',
    description:
      'Browse the library alphabetically, a page at a time, optionally within one category. Every response also lists the categories with their icon counts. Prefer search_icons when you know what you need.',
    inputSchema: {
      category: category.optional(),
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(200).default(50),
    },
    outputSchema: LIST_OUTPUT,
    annotations: { title: 'List icons', ...READ_ONLY },
  }, ({ category, offset, limit }) => {
    log({ tool: 'list_icons', category: category ?? null });
    return result({ ...listIcons({ category, offset, limit }) });
  });

  server.registerTool('get_framework_setup', {
    title: 'Get framework setup',
    description:
      'How to install and use the Fos Icons package for a framework: install steps, naming rule, props, an example and accessibility guidance.',
    inputSchema: { framework },
    outputSchema: SETUP_OUTPUT,
    annotations: { title: 'Get framework setup', ...READ_ONLY },
  }, ({ framework }) => {
    log({ tool: 'get_framework_setup', framework });
    return result({ ...frameworkSetup(framework) });
  });

  return server;
}
