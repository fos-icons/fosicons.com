import { describe, expect, it } from 'vitest';
import { handleMcp } from '../api/mcp';
import { challengeResponse } from '../api/openai-apps-challenge';
import { canonicalName, checkIconNames, flutterName, iconCode, listIcons, searchIcons } from '../server/mcp/icons';
import catalog from '../src/data/catalog.json';

const ORIGIN = 'https://www.fosicons.com';
const quiet = () => {};
let id = 0;

async function rpc(method: string, params: Record<string, unknown> = {}) {
  const response = await handleMcp(new Request(`${ORIGIN}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'Mcp-Protocol-Version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  }), quiet);
  return { response, body: await response.json() };
}

const call = async (name: string, args: Record<string, unknown>) => (await rpc('tools/call', { name, arguments: args })).body.result;

describe('MCP endpoint', () => {
  it('initializes with server info and instructions', async () => {
    const { response, body } = await rpc('initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(body.result.serverInfo).toMatchObject({ name: 'fos-icons', title: 'Fos Icons' });
    expect(body.result.instructions).toMatch(/Never guess or invent an icon name/);
  });

  it('lists eight read-only tools', async () => {
    const { body } = await rpc('tools/list');
    const tools = body.result.tools as { name: string; annotations: Record<string, boolean> }[];
    expect(tools.map((t) => t.name).sort()).toEqual(['animate_icon', 'check_icon_names', 'get_animated_icon', 'get_framework_setup', 'get_icon_code', 'list_animated_icons', 'list_icons', 'search_icons']);
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
      expect((tool as { outputSchema?: { type: string } }).outputSchema?.type).toBe('object');
    }
  });

  it('answers CORS preflight and refuses GET', async () => {
    const preflight = await handleMcp(new Request(`${ORIGIN}/mcp`, { method: 'OPTIONS' }), quiet);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-headers')).toMatch(/Mcp-Protocol-Version/);
    const get = await handleMcp(new Request(`${ORIGIN}/mcp`), quiet);
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST, OPTIONS');
  });

  it('searches several queries in one call', async () => {
    const result = await call('search_icons', { queries: ['camera', 'qwxzzv'], limit: 3 });
    const [camera, miss] = result.structuredContent.results;
    expect(camera.icons[0]).toMatchObject({ name: 'camera', components: { regular: 'CameraRegular', filled: 'CameraFilled' } });
    expect(camera.icons.length).toBeLessThanOrEqual(3);
    expect(miss.total).toBe(0);
    expect(Array.isArray(miss.suggestions)).toBe(true);
  });

  it('serves curated animated icons and animates any icon', async () => {
    const list = await call('list_animated_icons', {});
    expect(list.structuredContent.icons.map((i: { name: string }) => i.name)).toContain('check');
    const check = await call('get_animated_icon', { name: 'check' });
    expect(check.structuredContent.svg).toContain('@keyframes fa-check-');
    expect((await call('get_animated_icon', { name: 'accordion' })).isError).toBe(true);
    const parts = await call('animate_icon', { name: 'wifi', split: true, motions: [] });
    expect(parts.structuredContent.parts).toHaveLength(4);
    const spun = await call('animate_icon', { name: 'plus', motions: [{ type: 'spin', parts: [0], deg: 90, hold: 0.4 }] });
    expect(spun.structuredContent.svg).toContain('fa-plus-m0');
    const injected = await call('animate_icon', { name: 'plus', motions: [{ type: 'keyframes', parts: [0], frames: { '50%': 'opacity:0}</style><script>' } }] });
    expect(injected.isError).toBe(true);
    expect((await call('animate_icon', { name: 'plus', motions: [{ type: 'spin', parts: [9] }] })).isError).toBe(true);
  });

  it('returns icon code, and an error with suggestions for unknown names', async () => {
    const ok = await call('get_icon_code', { name: 'camera', framework: 'react', style: 'duocolor', size: 32, primaryColor: '#245B9E' });
    expect(ok.isError).toBeFalsy();
    expect(ok.structuredContent.code).toBe("import { CameraDuocolor } from '@fos-icons/react';\n\n<CameraDuocolor size={32} primaryColor=\"#245B9E\" />");

    const bad = await call('get_icon_code', { name: 'camra', framework: 'react' });
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toMatch(/No icon named "camra"\. Closest: .*camera/);
  });

  it('returns results that match every output schema', async () => {
    const calls: [string, Record<string, unknown>][] = [
      ['search_icons', { queries: ['camera', 'zzqx'] }],
      ['get_icon_code', { name: 'camera', framework: 'svg' }],
      ['get_icon_code', { name: 'telescope', framework: 'flutter', style: 'duocolor' }],
      ['check_icon_names', { names: ['CameraFilled', 'camra'] }],
      ['list_icons', { category: 'Files', limit: 2 }],
      ['get_framework_setup', { framework: 'angular' }],
    ];
    for (const [name, args] of calls) {
      const result = await call(name, args);
      expect(result.isError, `${name} ${JSON.stringify(result.content)}`).toBeFalsy();
      expect(result.structuredContent).toBeTypeOf('object');
    }
  });

  it('rejects invalid arguments', async () => {
    const result = await call('get_icon_code', { name: 'camera', framework: 'jquery' });
    expect(result.isError).toBe(true);
  });
});

describe('icon lookups', () => {
  it('resolves the names agents write', () => {
    expect(canonicalName('fuel-pump')).toEqual({ name: 'fuel-pump' });
    expect(canonicalName('fuel pump')).toEqual({ name: 'fuel-pump' });
    expect(canonicalName('FuelPumpFilled')).toEqual({ name: 'fuel-pump', style: 'filled' });
    expect(canonicalName('<FuelPumpDuotone />')).toEqual({ name: 'fuel-pump', style: 'duotone' });
    expect(canonicalName('FosIcons.fuelPumpDuocolor')).toEqual({ name: 'fuel-pump', style: 'duocolor' });
    expect(canonicalName('FuelPump')).toEqual({ name: 'fuel-pump' });
  });

  it('round-trips every icon through its component and Flutter names', () => {
    for (const { name } of catalog.icons) {
      for (const style of ['regular', 'filled', 'duocolor', 'duotone'] as const) {
        const component = iconCode(name, 'react', { style }).identifier;
        expect(canonicalName(component)).toEqual({ name, style });
        expect(canonicalName(`FosIcons.${flutterName(name, style)}`)).toEqual({ name, style });
      }
    }
  });

  it('checks names and suggests real icons', () => {
    const [good, bad] = checkIconNames(['CameraRegular', 'camera-retro-vintage']);
    expect(good).toEqual({ input: 'CameraRegular', valid: true, name: 'camera', style: 'regular' });
    expect(bad.valid).toBe(false);
    expect(bad.suggestions).toContain('camera');
  });

  it('pages through a category', () => {
    const first = listIcons({ category: 'AI & agents', limit: 5 });
    expect(first.total).toBe(catalog.categories.find((c) => c.name === 'AI & agents')?.count);
    expect(first.icons).toHaveLength(5);
    expect(first.nextOffset).toBe(5);
    const all = listIcons({ limit: 200, offset: catalog.icons.length - 1 });
    expect(all.icons).toHaveLength(1);
    expect(all.nextOffset).toBeNull();
  });

  it('serves inline SVG for Regular only', () => {
    const svg = iconCode('camera', 'svg');
    expect(svg.svg).toMatch(/^<svg[^>]+viewBox="0 0 24 24"/);
    expect(svg.code).toContain(`${'https://www.fosicons.com'}/svg/regular/camera.svg`);
    const filled = iconCode('camera', 'svg', { style: 'filled' });
    expect(filled.svg).toBeUndefined();
    expect(filled.identifier).toBe('icons/filled/camera.svg');
  });

  it('writes Flutter code with Dart colors', () => {
    expect(iconCode('telescope', 'flutter', { style: 'duocolor', size: 32, primaryColor: '#245b9e' }).code)
      .toBe("import 'package:fos_icons/fos_icons.dart';\n\nFosIcon(\n  FosIcons.telescopeDuocolor,\n  size: 32,\n  primaryColor: Color(0xFF245B9E),\n)");
  });

  it('notes unpublished packages', () => {
    expect(iconCode('camera', 'svelte').notes[0]).toMatch(/not published/);
    expect(iconCode('camera', 'react').notes).toEqual([]);
  });

  it('ranks exact names first', () => {
    expect(searchIcons(['trash'])[0].icons[0].name).toBe('trash');
  });
});

describe('OpenAI domain verification', () => {
  it('serves the token as plain text, and 404 without one', async () => {
    const ok = challengeResponse(' abc123 '.trim());
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toMatch(/^text\/plain/);
    expect(await ok.text()).toBe('abc123');
    expect(challengeResponse('').status).toBe(404);
  });
});
