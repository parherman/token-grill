import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('provider marks use fixed geometry and borderless accent dots styled from the stylesheet', async () => {
    const [source, css] = await Promise.all([
        read('src/shell/accountChip.ts'),
        read('resources/stylesheet.css'),
    ]);
    assert.match(source, /new Clutter\.FixedLayout\(\)/);
    assert.match(source, /y_align: Clutter\.ActorAlign\.CENTER/);
    assert.match(source, /const MARK_DOT_SIZE = 6/);
    assert.match(source, /tokengrill-account-dot \$\{accentStyleClass\(instance\.accent\)\}/);
    assert.doesNotMatch(source, /set_style\(/);
    assert.match(css, /\.tokengrill-account-dot \{ border: 0; border-radius: 4px; \}/);
    for (const accent of ['blue', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'slate'])
        assert.match(css, new RegExp(`\\.tokengrill-accent-${accent} \\{ background-color: #[0-9a-f]{6}; \\}`));
});

test('the popup is built from native shell menu items and theme styles', async () => {
    const [indicator, detail] = await Promise.all([
        read('src/shell/indicator.ts'),
        read('src/shell/providerCard.ts'),
    ]);
    assert.match(indicator, /new PopupMenu\.PopupSwitchMenuItem\(_\('Automatic Updates'\)/);
    assert.match(indicator, /if \(Main\.sessionMode\.allowSettings\)\s*menu\.addAction\(_\('Preferences…'\)/);
    assert.match(indicator, /new PopupMenu\.PopupSeparatorMenuItem\(\)/);
    assert.match(indicator, /ngettext\('Refreshing %d Account…', 'Refreshing %d Accounts…', busy\)/);
    assert.match(indicator, /this\._addRow\(groups\.map/);
    assert.doesNotMatch(indicator, /add_style_class_name\('default'\)/, 'only one level may use a strong selected style');
    assert.doesNotMatch(indicator, /tokengrill-boxpointer|set_clip_to_allocation|Safely|try \{/);
    assert.match(detail, /new BarLevel\.BarLevel\(\{\s*style_class: 'slider tokengrill-meter'/);
    assert.match(detail, /PopupMenu\.Ornament\.DOT : PopupMenu\.Ornament\.NO_DOT/);
    assert.match(detail, /new PopupMenu\.PopupSubMenuMenuItem\(_\('Reset Credits'\)/);
    assert.match(detail, /class ProviderDetail extends PopupMenu\.PopupMenuSection/);
    for (const source of [indicator, detail])
        assert.doesNotMatch(source, /vertical: true/);
});

test('the stylesheet keeps fixed colours to accent dots and toggle tints', async () => {
    const css = await read('resources/stylesheet.css');
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const rule of rules.match(/[^{}]+\{[^}]*\}/g)) {
        const [selector] = rule.split('{');
        if (/#[0-9a-f]{3,8}\b/i.test(rule))
            assert.match(selector, /tokengrill-accent-|tokengrill-(flat-)?toggle/, `hex colour outside accent/toggle rules: ${selector.trim()}`);
        if (/\brgba?\(/i.test(rule))
            assert.match(selector, /tokengrill-(flat-)?toggle/, `rgb colour outside toggle rules: ${selector.trim()}`);
    }
    assert.doesNotMatch(rules, /\bhsla?\(|font-family/);
    assert.doesNotMatch(css, /Hallmark|\.ts\b/);
    assert.match(rules, /-st-accent-color/);
});

test('the chooser mirrors AdwToggleGroup with radio semantics, pseudo-class states and a focus ring', async () => {
    const [toggle, indicator, css] = await Promise.all([
        read('src/shell/toggleGroup.ts'),
        read('src/shell/indicator.ts'),
        read('resources/stylesheet.css'),
    ]);
    assert.match(toggle, /accessible_role: Atk\.Role\.RADIO_BUTTON/);
    assert.match(toggle, /checked: item\.checked/);
    assert.doesNotMatch(toggle, /key-press-event|set_style|notify::hover/);
    assert.match(indicator, /St\.Settings\.get\(\)\.high_contrast/);
    assert.match(indicator, /tokengrill-light/);
    for (const state of ['hover', 'active', 'checked', 'focus'])
        assert.match(css, new RegExp(`\\.tokengrill-toggle:${state}`));
    assert.match(css, /\.tokengrill-flat-toggle:focus \{ border-color: st-transparentize\(-st-accent-color, 0\.5\); \}/);
});

test('the account chooser groups providers and wraps their accounts', async () => {
    const source = await read('src/shell/indicator.ts');
    assert.match(source, /accountGroups\(state\.providers, current\?\.id \?\? '', state\.snapshots\)/);
    assert.match(source, /const SHORT_NAME_LENGTH = 9/);
    assert.match(source, /<= SHORT_NAME_LENGTH\) \? 3 : 2/);
    assert.match(source, /start \+= perRow/);
    assert.match(source, /segment\.id === focusedId/);
    assert.match(source, /this\._lastByKind/);
    assert.doesNotMatch(source, /St\.ScrollView|FlowLayout|_choiceId/);
});

test('refresh progress uses the native shell spinner and UI uses centralized packaged marks', async () => {
    const [dashboard, widgets, chip, metadata] = await Promise.all([
        read('src/shell/providerCard.ts'),
        read('src/prefs/widgets.ts'),
        read('src/shell/accountChip.ts'),
        read('src/core/providerMetadata.ts'),
    ]);
    assert.match(dashboard, /new Animation\.Spinner\(16, \{animate: true, hideOnStop: true\}\)/);
    assert.doesNotMatch(dashboard, /rotation-angle-z/);
    assert.match(widgets, /Gio\.FileIcon\.new\(file\)/);
    assert.match(widgets, /providerIconFile\(kind\)/);
    for (const kind of ['codex', 'claude', 'kiro', 'antigravity'])
        assert.match(metadata, new RegExp(`iconFile: '${kind}-symbolic\\.svg'`));
    assert.match(chip, /Gio\.icon_new_for_string\(`\$\{extensionPath\}\/icons\/providers\/\$\{providerIconFile\(kind\)\}`\)/);
});

test('Kiro details are monthly-only and show precise credits', async () => {
    const [dashboard, model] = await Promise.all([read('src/shell/providerCard.ts'), read('src/core/popupModel.ts')]);
    assert.match(dashboard, /return _\('Monthly'\)/);
    assert.match(dashboard, /metadata\.quotaWindows\.includes/);
    assert.match(model, /_\('%s of %s credits'\), used, formatQuotaNumber\(window\.limit\)/);
    assert.match(model, /pooled or unlimited/);
});

test('Kiro discovery checks the user-wide data store once and disables history', async () => {
    const [discovery, editor] = await Promise.all([read('src/prefs/discovery.ts'), read('src/prefs/providerEditorDialog.ts')]);
    assert.match(discovery, /newProvider\('kiro', defaultHome\('kiro'\)\)/);
    assert.match(editor, /localHistoryEnabled: metadata\.localHistorySupported && this\._history\.active/);
    assert.doesNotMatch(discovery, /\.t3/);
});

test('provider HTTP requests are bounded and cannot follow redirects', async () => {
    const source = await read('src/providers/base.ts');
    assert.match(source, /Soup\.MessageFlags\.NO_REDIRECT/);
    assert.match(source, /MAX_RESPONSE_BYTES = 1024 \* 1024/);
    assert.match(source, /uri\.get_scheme\(\) !== 'https'/);
    assert.match(source, /ALLOWED_HOSTS\.has\(host\)/);
    assert.match(source, /\.\.\.KIRO_SERVICE_HOSTS/);
    assert.doesNotMatch(source, /'User-Agent'/);
    assert.match(source, /const status = message\.status_code;/, 'GJS throws for status codes missing from Soup.Status, such as 429');
    assert.doesNotMatch(source, /get_status\(\)\s*;/);
    assert.match(source, /export const USER_AGENT = 'TokenGrill \(\+https:\/\/github\.com\/sh02sahil\/token-grill; [^']*Antigravity\)'/);
});

test('persisted state uses private permissions and bounded regular files', async () => {
    const source = await read('src/storage/atomicJson.ts');
    assert.match(source, /Gio\.FileType\.REGULAR/);
    assert.match(source, /MAX_STATE_BYTES = 4 \* 1024 \* 1024/);
    assert.match(source, /info\.get_size\(\) > MAX_STATE_BYTES/);
    assert.match(source, /Gio\.FileCreateFlags\.PRIVATE/);
    assert.match(source, /set_attribute_uint32\('unix::mode', 0o600\)/);
    assert.match(source, /set_attributes_async/);
    assert.doesNotMatch(source, /GLib\.chmod|replace_contents\(/);
});

test('notification state is initialized only after the extension is enabled', async () => {
    const source = await read('src/shell/notifications.ts');
    assert.match(source, /export class NotificationStore/);
    assert.match(source, /async initialize\(cancellable:[\s\S]*await readJson<.+>\(this\._writer\.path/);
    assert.doesNotMatch(source, /readJsonSync|constructor\([^)]*\) \{[^}]*readJson/);
});

test('notifications use per-account sources with symbolic icons and lifecycle cleanup', async () => {
    const [notification, runtime] = await Promise.all([
        read('src/shell/notifications.ts'),
        read('src/runtime.ts'),
    ]);
    assert.doesNotMatch(notification, /Main\.notify\(/);
    assert.match(notification, /new MessageTray\.Source\(\{title: header, icon\}\)/);
    assert.match(notification, /existing\.title = header;/);
    assert.match(notification, /new MessageTray\.Notification/);
    assert.match(notification, /providerGicon\(this\._extension\.path, instance\.kind\)/);
    assert.doesNotMatch(notification, /EmblemedIcon|BytesIcon|<svg|accentColor|catch\(\(\) => \{\}\)/);
    assert.match(notification, /notifyTest\(instance:[\s\S]*testNotificationText/);
    assert.match(notification, /this\._sourceFor\(instance, text\.header\)/);
    assert.doesNotMatch(notification, /— Token Grill/);
    assert.match(notification, /private readonly _sources = new Map<string, MessageTray\.Source>\(\)/);
    assert.match(notification, /source\.connect\('destroy', \(\) => this\._sources\.delete\(instance\.id\)\)/);
    assert.match(notification, /source\.destroy\(MessageTray\.NotificationDestroyedReason\.SOURCE_CLOSED\)/);
    assert.match(runtime, /new NotificationStore\(extension\)/);
    assert.match(runtime, /get_string\('panel-percentage-mode'\) === 'used'/);
    assert.match(runtime, /this\._notifications!\.destroy\(\)/);
});

test('provider preferences use direct editing, confirmed deletion, and normalized reorder controls', async () => {
    const [page, editor, reorder, general] = await Promise.all([
        read('src/prefs/providersPage.ts'),
        read('src/prefs/providerEditorDialog.ts'),
        read('src/prefs/reorderDialog.ts'),
        read('src/prefs/generalPage.ts'),
    ]);
    assert.match(page, /icon_name: 'document-edit-symbolic'/);
    assert.match(page, /formatText\(_\('Edit %s'\), provider\.displayName\)/);
    assert.doesNotMatch(page, /Gtk\.MenuButton|view-more-symbolic|_overflow\(/);
    assert.match(page, /new Adw\.ButtonRow\(\{title: _\('Add Account…'\)/);
    assert.match(page, /reorderProviders\(providers, providers\.map/);
    assert.match(editor, /new Adw\.ButtonRow\(\{title: _\('Delete Account'\)/);
    assert.match(editor, /remove\.add_css_class\('destructive-action'\)/);
    assert.match(editor, /heading: _\('Delete Account\?'\)/);
    assert.match(editor, /heading: _\('Discard Changes\?'\)/);
    assert.match(editor, /if \(response !== 'delete'\)/);
    assert.match(general, /new Adw\.ToggleGroup/);
    assert.match(reorder, /new Gtk\.DragSource/);
    assert.match(reorder, /Gtk\.DropTarget\.new/);
    assert.match(reorder, /go-up-symbolic/);
    assert.match(reorder, /go-down-symbolic/);
    for (const source of [page, editor, reorder, general])
        assert.doesNotMatch(source, /\.get_children\(\)|set_cursor_from_name|\?\.\(/);
});

test('local history shows real figures or its scan state, and nothing when unsupported', async () => {
    const [model, metrics] = await Promise.all([read('src/core/popupModel.ts'), read('src/core/historyMetrics.ts')]);
    assert.match(model, /at API prices/);
    assert.match(model, /case 'unsupported':\s*case 'off':\s*return null;/);
    assert.match(metrics, /export type HistoryState = 'unsupported' \| 'off' \| 'waiting' \| 'updating' \| 'failed' \| 'ready'/);
    assert.doesNotMatch(metrics, /TOKENS|USD|Waiting…/);
});

test('notification preferences write scoped test requests handled without milestone writes', async () => {
    const [prefs, runtime, notifications, schema] = await Promise.all([
        read('src/prefs/notificationsPage.ts'), read('src/runtime.ts'), read('src/shell/notifications.ts'), read('schemas/org.gnome.shell.extensions.tokengrill.gschema.xml'),
    ]);
    assert.match(prefs, /title: _\('Send Test Notification'\)/);
    assert.match(prefs, /notification-test-request/);
    assert.match(prefs, /provider\.enabled \? provider\.displayName/);
    assert.match(runtime, /parseTestNotificationRequest/);
    assert.match(runtime, /_notifications!\.notifyTest/);
    const notifyTest = notifications.slice(notifications.indexOf('notifyTest('), notifications.indexOf('removeProvider('));
    assert.doesNotMatch(notifyTest, /this\._state|_persist\(/);
    assert.match(schema, /name="notification-test-request"/);
});

test('runtime storage and pricing initialization precede Shell UI and scheduling', async () => {
    const [entry, source] = await Promise.all([read('src/extension.ts'), read('src/runtime.ts')]);
    const initialize = source.indexOf('await Promise.all([');
    const indicator = source.indexOf('this._indicator = new TokenGrillIndicator');
    const scheduler = source.indexOf('scheduler.start()');
    assert.ok(initialize >= 0 && initialize < indicator && indicator < scheduler);
    assert.match(source, /if \(cancellable\.is_cancelled\(\)\)\s*return;/);
    assert.match(source, /Main\.panel\.addToStatusArea\(this\._extension\.uuid/);
    assert.match(source, /new Soup\.Session\(\{timeout: 30, user_agent: USER_AGENT\}\)/);
    assert.match(entry, /this\._runtime = new Runtime\(this\);\s*this\._runtime\.start\(\);/);
    assert.match(entry, /this\._runtime\?\.stop\(\);\s*this\._runtime = null;/);
    assert.doesNotMatch(source + entry, /sessionMode\.connect|setLocked|pause-when-session-locked/);
});

test('collectors are runtime-owned and dropped with the runtime', async () => {
    const [registry, runtime] = await Promise.all([read('src/providers/registry.ts'), read('src/runtime.ts')]);
    assert.doesNotMatch(registry, /^const collectors/m);
    assert.match(registry, /export function createCollectors\(\)[\s\S]*new CodexCollector\(\)/);
    assert.match(runtime, /_collectors: Record<ProviderKind, ProviderCollector> \| null = createCollectors\(\)/);
    assert.match(runtime, /this\._collectors = null/);
});

test('UI signals are disconnected and owned actors are released', async () => {
    const [dashboard, indicator] = await Promise.all([
        read('src/shell/providerCard.ts'),
        read('src/shell/indicator.ts'),
    ]);
    // Child actors are destroyed with their parent, so only long-lived emitters are disconnected.
    assert.match(dashboard, /this\._refreshButton\.connect\('clicked', \(\) => onRefresh\(\)\)/);
    assert.match(indicator, /this\._box\.destroy_all_children\(\)/);
    assert.match(indicator, /this\._themeContext!\.disconnect\(this\._themeChangedId!\);\s*this\._themeChangedId = null;\s*this\._themeContext = null;\s*this\._ui = null;\s*super\.destroy\(\)/);
    assert.doesNotMatch(indicator, /resetShellCursor|menu\.removeAll/);
});

test('runtime releases all lifecycle-owned references during stop', async () => {
    const source = await read('src/runtime.ts');
    for (const name of ['scheduler', 'session', 'collectors', 'aggregates', 'checkpoints', 'notifications', 'settings', 'cancellable', 'indicator'])
        assert.match(source, new RegExp(`this\\._${name} = null`));
    assert.match(source, /this\._settingsChangedId = null/);
    assert.match(source, /this\._session!\.abort\(\)/);
    assert.match(source, /Promise\.all\(\[this\._aggregates!\.flush\(\), this\._checkpoints!\.flush\(\), this\._notifications!\.flush\(\)\]\)/);
});

test('store writes are serialized and cancellation bypasses provider failures', async () => {
    const [atomic, aggregate, checkpoint, notification, base, runtime] = await Promise.all([
        read('src/storage/atomicJson.ts'),
        read('src/storage/aggregateStore.ts'),
        read('src/storage/checkpointStore.ts'),
        read('src/shell/notifications.ts'),
        read('src/providers/base.ts'),
        read('src/runtime.ts'),
    ]);
    assert.match(atomic, /this\._pending = this\._pending\.then\(write, write\)/);
    assert.match(atomic, /this\._dirty = true;\s*throw error;/);
    for (const source of [aggregate, checkpoint, notification])
        assert.match(source, /new SerialWriter\(/);
    assert.match(base, /if \(!\(error instanceof CollectorError\)\)\s*throw error/);
    assert.match(runtime, /catch \(error\) \{\s*if \(cancellable\.is_cancelled\(\)\)\s*return;/);
    assert.doesNotMatch(aggregate + checkpoint + notification, /\.catch\(\(\) => \{\}\)/);
});

test('review artifacts exclude compiled schemas and use the pinned Shexli runner', async () => {
    const [build, install, release, checker] = await Promise.all([
        read('tools/build.mjs'),
        read('tools/install.mjs'),
        read('tools/release-check.mjs'),
        read('tools/shexli-check.mjs'),
    ]);
    assert.doesNotMatch(build, /glib-compile-schemas/);
    assert.match(install, /glib-compile-schemas/);
    assert.match(release, /gschemas\.compiled/);
    assert.match(checker, /shexli==0\.2\.1/);
    assert.match(checker, /tree-sitter==0\.25\.2/);
    assert.match(checker, /report\.summary\.finding_count/);
});

test('new provider defaults are generated and validation errors stay field-specific', async () => {
    const source = await read('src/prefs/providerEditorDialog.ts');
    assert.match(source, /function generatedDefaults\(kind: ProviderKind\)/);
    assert.match(source, /displayPath\(defaultHome\(kind\)\)/);
    assert.match(source, /markField\(this\._name, errors\.displayName\)/);
    assert.match(source, /markField\(this\._home, errors\.accountHome\)/);
    assert.match(source, /markField\(this\._auth, errors\.authFileOverride\)/);
    assert.match(source, /markField\(this\._sessions, errors\.sessionsDirectoryOverride\)/);
    assert.doesNotMatch(source, /_nameEdited|_homeEdited|_accentEdited/);
});

test('nested shell inherits user settings and rejects conflicting Token Grill installs', async () => {
    const source = await read('tools/nested-shell.sh');
    assert.doesNotMatch(source, /GSETTINGS_BACKEND/);
    assert.match(source, /metadata\.uuid !== uuid/);
    assert.match(source, /Conflicting Token Grill installation/);
    assert.match(source, /wait_for_state ACTIVE/);
    assert.match(source, /^unset GDK_BACKEND$/m);
    assert.doesNotMatch(source, /gnome-extensions enable.*\|\| true/);
});
