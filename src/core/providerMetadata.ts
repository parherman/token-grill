import type {AccentColor, CanonicalQuotaWindow, ProviderKind, QuotaWindowPreference} from './types.js';

export interface ProviderMetadata {
    label: string;
    defaultAccent: AccentColor;
    iconFile: string;
    quotaWindows: CanonicalQuotaWindow[];
    defaultQuotaWindow: QuotaWindowPreference;
    localHistorySupported: boolean;
}

export const PROVIDER_METADATA: Record<ProviderKind, ProviderMetadata> = {
    codex: {
        label: 'Codex',
        defaultAccent: 'green',
        iconFile: 'codex-symbolic.svg',
        quotaWindows: ['five-hour', 'weekly'],
        defaultQuotaWindow: 'automatic',
        localHistorySupported: true,
    },
    claude: {
        label: 'Claude',
        defaultAccent: 'orange',
        iconFile: 'claude-symbolic.svg',
        quotaWindows: ['five-hour', 'weekly'],
        defaultQuotaWindow: 'automatic',
        localHistorySupported: true,
    },
    kiro: {
        label: 'Kiro',
        defaultAccent: 'purple',
        iconFile: 'kiro-symbolic.svg',
        quotaWindows: ['monthly'],
        defaultQuotaWindow: 'monthly',
        localHistorySupported: false,
    },
    antigravity: {
        label: 'Antigravity',
        defaultAccent: 'teal',
        iconFile: 'antigravity-symbolic.svg',
        quotaWindows: ['five-hour', 'weekly'],
        defaultQuotaWindow: 'automatic',
        localHistorySupported: false,
    },
    cursor: {
        label: 'Cursor',
        defaultAccent: 'blue',
        iconFile: 'cursor-symbolic.svg',
        quotaWindows: ['weekly', 'monthly'],
        defaultQuotaWindow: 'automatic',
        localHistorySupported: false,
    },
};

export const PROVIDER_KINDS = Object.keys(PROVIDER_METADATA) as ProviderKind[];

export function providerMetadata(kind: ProviderKind): ProviderMetadata {
    return PROVIDER_METADATA[kind];
}

export function providerIconFile(kind: ProviderKind): string {
    return providerMetadata(kind).iconFile;
}
