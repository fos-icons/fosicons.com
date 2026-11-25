import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Breadcrumbs, CopyCode, LandingSection } from '../components/LandingParts';
import { ButtonAnchor, UiIcon } from '../components/ui';
import { LocalLink, useI18n } from '../i18n';
import { catalog, ICONS_ROUNDED } from '../lib/catalog';
import { CONTAINER } from '../lib/layout';
import { LIBRARY_URL } from '../lib/links';
export { AGENT_CLIENTS } from '../lib/agents';

/**
 * /ai-agents: how to connect Claude Code, Codex, ChatGPT, Cursor, VS Code, and
 * any MCP client to the Fos Icons MCP server (api/mcp.ts) and the Agent
 * Skills in the library repository. Long-form English, like the Docs page.
 */

export const MCP_URL = 'https://www.fosicons.com/mcp';
const SERVER = 'fos-icons';
/** One-click installs: Cursor takes base64 JSON config, VS Code takes URL-encoded JSON. */
export const CURSOR_INSTALL = `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER}&config=${btoa(JSON.stringify({ url: MCP_URL }))}`;
export const VSCODE_INSTALL = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: SERVER, type: 'http', url: MCP_URL }))}`;

export const AGENT_TOOLS: [string, string][] = [
  ['search_icons', 'Searches names, tags, aliases, and categories, up to 20 queries at once, with suggestions when nothing matches.'],
  ['get_icon_code', 'Install, import, and usage code for one icon in React, Vue, Svelte, SolidJS, Angular, Flutter, or plain SVG.'],
  ['check_icon_names', 'Checks names your code already uses and suggests real icons for any that don’t exist.'],
  ['list_icons', 'Pages through every icon alphabetically, optionally within one category.'],
  ['get_framework_setup', 'Package install steps, the naming rule, props, an example, and accessibility guidance.'],
];

const code = (text: string) => <code className="rounded bg-sunken px-1 py-0.5 text-ink">{text}</code>;
const external = (href: string, children: ReactNode) => (
  <a href={href} target="_blank" rel="noreferrer" className="text-brand underline underline-offset-2">{children}</a>
);

function Client({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex min-w-0 scroll-mt-6 flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <h3 id={`${id}-title`} className="font-display text-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}

const Note = ({ children }: { children: ReactNode }) => <p className="text-sm leading-relaxed text-muted">{children}</p>;

function Points({ items }: { items: ReactNode[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed">
          <UiIcon name="check" className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AiAgentsPage() {
  const { t, list, n } = useI18n();
  const count = `${n(ICONS_ROUNDED)}+`;
  const styles = list(catalog.styles.map((s) => t(`style.${s}`)));
  const link = 'text-brand underline underline-offset-2';
  const { hash } = useLocation();
  // Links from the header menu land on a card; this page renders after navigation, so scroll here.
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);

  const faq: [string, ReactNode][] = [
    ['Is it free?', <>Yes. The MCP server, plugins, and skills are free for everyone, with no account or API key.</>],
    ['What does the server see?', <>Only the tool calls your agent makes: icon names, search words, and the framework. It reads nothing from your project. Searches that find nothing are logged so we can add the icons people look for; see <LocalLink to="/docs#privacy" className={link}>Privacy</LocalLink>.</>],
    ['Does it cover the paid styles?', <>Code for all four styles ({styles}) is free, because the packages are MIT and include every style. Raw SVG markup comes back for Regular; the other styles point to the packages or the website export.</>],
    ['Is there a rate limit?', <>Yes, a generous per-IP limit that normal agent use won’t reach. If you hit it, the server answers 429 for a minute.</>],
    ['My agent still invents icon names.', <>Install the skill as well as the server; it tells the agent to search first and to run {code('check_icon_names')} before finishing. Or ask it directly: “check my Fos icon names”.</>],
  ];

  return (
    <div className={`${CONTAINER} pb-24 pt-8 sm:pt-10`}>
      <Breadcrumbs items={[{ label: t('iconPage.allIcons'), to: '/' }, { label: 'AI agents' }]} />
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Fos Icons for AI agents</h1>
      <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">
        Connect your coding agent to all {count} icons. It searches the real library and writes the exact import for your
        framework, instead of guessing names that don’t exist or drawing SVG paths by hand. Free, read-only, and no sign-in.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonAnchor href={CURSOR_INSTALL} variant="primary" size="lg">Add to Cursor</ButtonAnchor>
        <ButtonAnchor href={VSCODE_INSTALL} size="lg">Add to VS Code</ButtonAnchor>
        <ButtonAnchor href="#clients" size="lg">Other agents</ButtonAnchor>
      </div>

      <LandingSection id="clients" title="Install" className="mt-12">
        <div className="grid gap-4 lg:grid-cols-2">
          <Client id="claude-code" title="Claude Code">
            <Note>The plugin adds the MCP server and two skills: one for using the icons, one for migrating from lucide or Heroicons. Run these in Claude Code:</Note>
            <CopyCode lang="sh" what="Claude Code plugin commands" code={'/plugin marketplace add fos-icons/fos-icons\n/plugin install fos-icons@fos-icons'} />
            <Note>Only want the server? {code(`claude mcp add --transport http ${SERVER} ${MCP_URL}`)}</Note>
          </Client>
          <Client id="codex" title="Codex">
            <Note>The plugin bundles the server and the skills:</Note>
            <CopyCode lang="sh" what="Codex plugin commands" code={'codex plugin marketplace add fos-icons/fos-icons\ncodex plugin add fos-icons@fos-icons'} />
            <Note>Server only: {code(`codex mcp add ${SERVER} --url ${MCP_URL}`)}</Note>
          </Client>
          <Client id="chatgpt" title="ChatGPT">
            <Note>
              A listing in the ChatGPT app directory is on the way. Until then, on a paid plan, turn on developer mode
              (Settings → Apps → Advanced settings), create an app, and paste this URL with no authentication:
            </Note>
            <CopyCode lang="text" what="MCP server URL" code={MCP_URL} />
          </Client>
          <Client id="cursor" title="Cursor">
            <Note>Use the one-click install above, or add this to {code('.cursor/mcp.json')} (or {code('~/.cursor/mcp.json')} for every project):</Note>
            <CopyCode lang="json" what="Cursor MCP config" code={JSON.stringify({ mcpServers: { [SERVER]: { url: MCP_URL } } }, null, 2)} />
          </Client>
          <Client id="vscode" title="VS Code">
            <Note>Use the one-click install above, or add this to {code('.vscode/mcp.json')}, then use it from Copilot Chat in agent mode:</Note>
            <CopyCode lang="json" what="VS Code MCP config" code={JSON.stringify({ servers: { [SERVER]: { type: 'http', url: MCP_URL } } }, null, 2)} />
          </Client>
          <Client id="other" title="Any MCP client">
            <Note>Windsurf, Zed, Gemini CLI, Cline, and others: add a remote server with the Streamable HTTP transport and no authentication.</Note>
            <CopyCode lang="text" what="MCP server URL" code={MCP_URL} />
          </Client>
          <Client id="skills" title="Agent Skills">
            <Note>
              The skills work in any agent that reads {code('SKILL.md')} files, with or without the server. Install them into
              your project with the skills CLI, or copy them from {external(`${LIBRARY_URL}/tree/main/skills`, 'GitHub')}:
            </Note>
            <CopyCode lang="sh" what="Skills install command" code={'npx skills add fos-icons/fos-icons'} />
          </Client>
          <Client id="rules" title="Cursor rule">
            <Note>
              For agents without MCP, a rule file teaches the naming scheme and the packages. Save{' '}
              {external(`${LIBRARY_URL}/blob/main/plugins/cursor/fos-icons.mdc`, 'fos-icons.mdc')} in {code('.cursor/rules/')}.
            </Note>
          </Client>
        </div>
      </LandingSection>

      <LandingSection id="tools" title="Tools" className="mt-12">
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-muted">
          Every tool is read-only: the server looks things up in the icon catalog and changes nothing.
        </p>
        <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {AGENT_TOOLS.map(([name, does]) => (
            <div key={name} className="grid gap-1 p-4 sm:grid-cols-[14rem_1fr] sm:gap-4">
              <dt><code className="text-sm font-medium text-ink">{name}</code></dt>
              <dd className="text-sm leading-relaxed text-muted">{does}</dd>
            </div>
          ))}
        </dl>
      </LandingSection>

      <LandingSection id="try" title="Try asking" className="mt-12">
        <Points items={[
          <>“Add a settings button with a Fos gear icon to the navbar.”</>,
          <>“Which Fos icons would work for an empty inbox state? Show me three.”</>,
          <>“Replace every lucide-react icon in this project with Fos Icons.”</>,
          <>“Check that all the Fos icon names in src/ exist.”</>,
        ]} />
      </LandingSection>

      <LandingSection id="faq" title="Questions" className="mt-12">
        <div className="max-w-3xl">
          {faq.map(([q, a]) => (
            <details key={q} className="group border-t border-line last:border-b">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium transition-colors hover:text-brand [&::-webkit-details-marker]:hidden">
                {q}
                <UiIcon name="chevron-down" className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="max-w-[62ch] pb-5 text-sm leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted">
          Building your own client? The <LocalLink to="/docs#ai-agents" className={link}>docs</LocalLink> cover the tools
          and the <LocalLink to="/docs#terms" className={link}>terms</LocalLink> cover use of the server.
        </p>
      </LandingSection>
    </div>
  );
}
