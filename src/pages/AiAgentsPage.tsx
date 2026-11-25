import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useActiveSection } from '../hooks/useActiveSection';
import { Breadcrumbs, CopyCode, LandingSection } from '../components/LandingParts';
import { ButtonAnchor, UiIcon } from '../components/ui';
import { LocalLink, useI18n } from '../i18n';
import { catalog, ICONS_ROUNDED } from '../lib/catalog';
import { CONTAINER } from '../lib/layout';
import { LIBRARY_URL } from '../lib/links';

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
    <section id={id} aria-labelledby={`${id}-title`} className="flex min-w-0 scroll-mt-6 flex-col gap-3 border-t border-line pt-8 first:border-t-0 first:pt-0">
      <h3 id={`${id}-title`} className="font-display text-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}

const Note = ({ children }: { children: ReactNode }) => <p className="text-sm leading-relaxed text-muted">{children}</p>;

function Points({ items }: { items: ReactNode[] }) {
  return (
    <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed">
          <UiIcon name="check" className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** The right-hand "On this page" list: every setup card, then the reference sections. */
export const PAGE_SECTIONS: { id: string; label: string; install?: boolean }[] = [
  { id: 'claude-code', label: 'Claude Code', install: true },
  { id: 'codex', label: 'Codex', install: true },
  { id: 'chatgpt', label: 'ChatGPT', install: true },
  { id: 'cursor', label: 'Cursor', install: true },
  { id: 'vscode', label: 'VS Code', install: true },
  { id: 'other', label: 'Any MCP client', install: true },
  { id: 'skills', label: 'Agent Skills', install: true },
  { id: 'rules', label: 'Cursor rule', install: true },
  { id: 'tools', label: 'Tools' },
  { id: 'try', label: 'Try asking' },
  { id: 'faq', label: 'Questions' },
];
const SECTION_IDS = PAGE_SECTIONS.map(({ id }) => id);

function PageContents({ active, onChoose }: { active: string; onChoose: (id: string) => void }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const item = (id: string, label: string, nested = false) => (
    <li key={id}>
      <a
        href={`#${id}`}
        aria-current={active === id ? 'location' : undefined}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
          event.preventDefault();
          onChoose(id);
          setOpen(false);
        }}
        className={`flex min-h-11 items-center rounded-md px-2 text-sm lg:min-h-8 ${nested ? 'ml-3' : ''} ${active === id ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-sunken hover:text-ink'}`}
      >
        {label}
      </a>
    </li>
  );
  return (
    <aside className="min-w-0 self-start lg:sticky lg:top-8 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:p-1">
      <nav aria-label="On this page">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink lg:hidden"
        >
          On this page
          <UiIcon name="chevron-down" className={`size-4 ${open ? 'rotate-180' : ''}`} />
        </button>
        <div id={listId} className={`${open ? 'block' : 'hidden'} pt-2 lg:block lg:pt-0`}>
          <p aria-hidden="true" className="mb-2 hidden pl-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted lg:block">On this page</p>
          <p className="px-2 py-1 text-sm font-medium text-ink">Install</p>
          <ul className="space-y-0.5 pb-2">
            {PAGE_SECTIONS.filter((s) => s.install).map(({ id, label }) => item(id, label, true))}
          </ul>
          <ul className="space-y-0.5 border-t border-line pt-2">
            {PAGE_SECTIONS.filter((s) => !s.install).map(({ id, label }) => item(id, label))}
          </ul>
        </div>
      </nav>
    </aside>
  );
}

/** Smooth unless the visitor asked for reduced motion. */
const scrollToSection = (id: string, smooth = true) => {
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'auto' });
};

/** How long to wait for the editor to take focus before saying nothing happened. */
const OPEN_TIMEOUT_MS = 1500;

/**
 * cursor:// and vscode: links open the editor. Browsers give no signal when
 * no app handles the link, so if the page keeps focus, report which app didn't open.
 */
function useOpenCheck() {
  const [missed, setMissed] = useState<string | null>(null);
  const cleanup = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => cleanup.current?.(), []);
  const watch = (app: string) => {
    cleanup.current?.();
    setMissed(null);
    const left = () => cleanup.current?.();
    const timer = window.setTimeout(() => { cleanup.current?.(); setMissed(app); }, OPEN_TIMEOUT_MS);
    window.addEventListener('blur', left);
    document.addEventListener('visibilitychange', left);
    cleanup.current = () => {
      window.clearTimeout(timer);
      window.removeEventListener('blur', left);
      document.removeEventListener('visibilitychange', left);
      cleanup.current = undefined;
    };
  };
  return [missed, watch] as const;
}

export default function AiAgentsPage() {
  const { t, list, n } = useI18n();
  const count = `${n(ICONS_ROUNDED)}+`;
  const styles = list(catalog.styles.map((s) => t(`style.${s}`)));
  const link = 'text-brand underline underline-offset-2';
  const { hash } = useLocation();
  const navigate = useNavigate();
  // Arriving with a hash jumps straight there; choices made on the page scroll smoothly.
  const landed = useRef(false);
  const [active, setActive] = useActiveSection(SECTION_IDS);
  const [missed, watchOpen] = useOpenCheck();
  // A link to a card (#codex) lands after the page renders, so scroll here.
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (!id) { landed.current = true; return; }
    if (SECTION_IDS.includes(id)) setActive(id);
    scrollToSection(id, landed.current);
    landed.current = true;
  }, [hash, setActive]);
  const choose = (id: string) => {
    if (`#${id}` !== hash) {
      navigate({ hash: `#${id}` }, { replace: true, preventScrollReset: true });
    } else {
      setActive(id);
      scrollToSection(id);
    }
  };

  const faq: [string, ReactNode][] = [
    ['Is it free?', <>Yes. The MCP server, plugins, and skills are free for everyone, with no account or API key.</>],
    ['What does the server see?', <>Only the tool calls your agent makes: icon names, search words, and the framework. It reads nothing from your project. Searches that find nothing are logged so we can add the icons people look for; see <LocalLink to="/docs#privacy" className={link}>Privacy</LocalLink>.</>],
    ['Does it cover the paid styles?', <>Code for all four styles ({styles}) is free, because the packages are MIT and include every style. Raw SVG markup comes back for Regular; the other styles point to the packages or the website export.</>],
    ['Is there a rate limit?', <>Yes, a generous per-IP limit that normal agent use won’t reach. If you hit it, the server answers 429 for a minute.</>],
    ['My agent still invents icon names.', <>Install the skill as well as the server; it tells the agent to search first and to run {code('check_icon_names')} before finishing. Or ask it directly: “check my Fos icon names”.</>],
  ];

  return (
    <div className={`code-stone ${CONTAINER} pb-24 pt-8 sm:pt-10`}>
      <Breadcrumbs items={[{ label: t('iconPage.allIcons'), to: '/' }, { label: 'AI agents' }]} />
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Fos Icons for <span className="text-brand">AI agents</span>
      </h1>
      <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">
        Connect your coding agent to all {count} icons. It searches the real library and writes the exact import for your
        framework, instead of guessing names that don’t exist or drawing SVG paths by hand. Free, read-only, and no sign-in.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonAnchor href={CURSOR_INSTALL} onClick={() => watchOpen('cursor')} variant="primary" size="lg">Add to Cursor</ButtonAnchor>
        <ButtonAnchor href={VSCODE_INSTALL} onClick={() => watchOpen('vscode')} size="lg">Add to VS Code</ButtonAnchor>
        <ButtonAnchor href="#clients" onClick={(event) => { event.preventDefault(); choose('claude-code'); }} size="lg">Other agents</ButtonAnchor>
      </div>
      <p id="install-status" role="status" className="mt-3 min-h-5 text-sm text-muted">
        {missed && (<>
          {missed === 'cursor' ? 'Cursor' : 'VS Code'} didn’t open. Install it first, or{' '}
          <a href={`#${missed}`} onClick={(event) => { event.preventDefault(); choose(missed); }} className={link}>add the server by hand</a>.
        </>)}
      </p>

      <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_13rem] lg:gap-12">
      <PageContents active={active} onChoose={choose} />
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
      <LandingSection id="clients" title="Install">
        <div className="grid max-w-4xl gap-8">
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
        <dl className="divide-y divide-line border-y border-line">
          {AGENT_TOOLS.map(([name, does]) => (
            <div key={name} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-4">
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
      </div>
    </div>
  );
}
