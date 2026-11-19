import type {AccentColor, AccountApp, CanonicalQuotaWindow, ProviderKind, QuotaWindowPreference} from './types.js';

export interface ProviderMetadata {
    label: string;
    defaultAccent: AccentColor;
    iconFile: string;
    quotaWindows: CanonicalQuotaWindow[];
    defaultQuotaWindow: QuotaWindowPreference;
    localHistorySupported: boolean;
    // The apps an account can be read from; the first is the default.
    apps: readonly [AccountApp, ...AccountApp[]];
    measure: 'limits' | 'balance';
}

export const PROVIDER_METADATA: Record<ProviderKind, ProviderMetadata> = {
    codex: {
        label: 'Codex',
        defaultAccent: 'green',
        iconFile: 'codex-symbolic.svg',
        quotaWindows: ['five-hour', 'weekly'],
        defaultQuotaWindow: 'automatic',
        localHistorySupported: true,
        apps: ['codex-cli', 'opencode'],
        measure: 'limits',
    },
    claude: {
        label: 'Claude',
        defaultAccent: 'orange',
        iconFile: 'claude-symbolic.svg',
        quotaWindows: ['five-hour', 'weekly'],
        defaultQuotaWindow: 'automatic',
        localHistorySupported: true,
        apps: ['claude-code', 'opencode'],
        measure: 'limits',
    },
    kiro: {
        label: 'Kiro',
        defaultAccent: 'purple',
        iconFile: 'kiro-symbolic.svg',
        quotaWindows: ['monthly'],
        defaultQuotaWindow: 'monthly',
        localHistorySupported: false,
        apps: ['kiro-cli'],
        measure: 'limits',
    },
    antigravity: {
        label: 'Antigravity',
        defaultAccent: 'teal',
        iconFile: 'antigravity-symbolic.svg',
        quotaWindows: ['five-hour', 'weekly'],
        defaultQuotaWindow: 'automatic',
        localHistorySupported: false,
        apps: ['antigravity'],
        measure: 'limits',
    },
    copilot: {
        label: 'Copilot',
        defaultAccent: 'slate',
        iconFile: 'copilot-symbolic.svg',
        quotaWindows: ['monthly'],
        defaultQuotaWindow: 'monthly',
        localHistorySupported: false,
        apps: ['github-cli', 'copilot-cli', 'opencode'],
        measure: 'limits',
    },
    'opencode-go': {
        label: 'OpenCode Go',
        defaultAccent: 'yellow',
        iconFile: 'opencode-go-symbolic.svg',
        quotaWindows: ['five-hour', 'weekly', 'monthly'],
        defaultQuotaWindow: 'automatic',
        localHistorySupported: false,
        apps: ['opencode'],
        measure: 'limits',
    },
    'deepseek': {
        label: 'DeepSeek',
        defaultAccent: 'blue',
        iconFile: 'deepseek-symbolic.svg',
        quotaWindows: [],
        defaultQuotaWindow: 'automatic',
        localHistorySupported: false,
        apps: ['keyring', 'opencode', 'claude-settings'],
        measure: 'balance',
    },
    'kimi': {
        label: 'Kimi Code',
        defaultAccent: 'pink',
        iconFile: 'kimi-symbolic.svg',
        quotaWindows: ['five-hour', 'weekly', 'monthly'],
        defaultQuotaWindow: 'automatic',
        localHistorySupported: false,
        apps: ['kimi-cli', 'opencode'],
        measure: 'limits',
    },
    cursor: {
        label: 'Cursor',
        defaultAccent: 'blue',
        iconFile: 'cursor-symbolic.svg',
        quotaWindows: ['weekly', 'monthly'],
        defaultQuotaWindow: 'automatic',
        localHistorySupported: false,
        apps: ['cursor-ide', 'cursor-agent'],
        measure: 'limits',
    },
};

export function providerMetadata(kind: ProviderKind): ProviderMetadata {
    return PROVIDER_METADATA[kind];
}

export function providerIconFile(kind: ProviderKind): string {
    return providerMetadata(kind).iconFile;
}
