import type Gio from 'gi://Gio';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {CollectorError} from '../core/errors.js';
import type {ProviderInstance, ProviderKind} from '../core/types.js';
import {antigravityCredentialStatus} from '../providers/antigravity/auth.js';
import {loadClaudeAccessToken} from '../providers/claude/auth.js';
import {loadCodexAccessToken} from '../providers/codex/auth.js';
import {loadCopilotToken} from '../providers/copilot/auth.js';
import {CursorAuthStore} from '../providers/cursor/auth.js';
import {loadDeepSeekKey} from '../providers/deepseek/auth.js';
import {loadKimiAuth} from '../providers/kimi/auth.js';
import {kiroCredentialStatus} from '../providers/kiro/auth.js';
import {loadOpenCodeGoKey} from '../providers/opencode-go/auth.js';

export type CredentialState =
    | 'authenticated'
    | 'expired'
    | 'expired-refreshable'
    | 'expired-external'
    | 'login-required'
    | 'unreadable'
    | 'database-unreadable'
    | 'gda-missing'
    | 'libsecret-missing';

async function authFileState(load: Promise<unknown>, dependency: 'gda-missing' | 'libsecret-missing' = 'libsecret-missing'): Promise<CredentialState> {
    try {
        await load;
        return 'authenticated';
    } catch (error) {
        if (!(error instanceof CollectorError))
            throw error;
        if (error.code === 'auth-expired')
            return 'expired';
        if (error.code === 'auth-invalid' || error.code === 'permission')
            return 'unreadable';
        if (error.code === 'dependency')
            return dependency;
        return 'login-required';
    }
}

async function kiroState(provider: ProviderInstance, cancellable: Gio.Cancellable): Promise<CredentialState> {
    const status = await kiroCredentialStatus(provider, cancellable);
    return status === 'dependency-missing' ? 'gda-missing' : status;
}

async function antigravityState(provider: ProviderInstance, cancellable: Gio.Cancellable): Promise<CredentialState> {
    const status = await antigravityCredentialStatus(provider, cancellable);
    if (status === 'dependency-missing')
        return 'libsecret-missing';
    return status === 'database-unreadable' ? 'unreadable' : status;
}

const CREDENTIAL_CHECKS: Record<ProviderKind, (provider: ProviderInstance, cancellable: Gio.Cancellable) => Promise<CredentialState>> = {
    codex: (provider, cancellable) => authFileState(loadCodexAccessToken(provider, cancellable)),
    claude: (provider, cancellable) => authFileState(loadClaudeAccessToken(provider, cancellable)),
    kiro: kiroState,
    antigravity: antigravityState,
    'copilot': (provider, cancellable) => authFileState(loadCopilotToken(provider, cancellable)),
    'opencode-go': (_provider, cancellable) => authFileState(loadOpenCodeGoKey(cancellable)),
    'deepseek': (provider, cancellable) => authFileState(loadDeepSeekKey(provider, cancellable)),
    'kimi': (provider, cancellable) => authFileState(loadKimiAuth(provider, cancellable)),
    cursor: (provider, cancellable) => authFileState(new CursorAuthStore().load(provider, cancellable), 'gda-missing'),
};

// Rejects only when cancelled or on an unexpected error.
export function credentialState(provider: ProviderInstance, cancellable: Gio.Cancellable): Promise<CredentialState> {
    return CREDENTIAL_CHECKS[provider.kind](provider, cancellable);
}

export function credentialLabel(state: CredentialState): string {
    const labels: Record<CredentialState, string> = {
        'authenticated': _('Authenticated'),
        'expired': _('Sign-in expired'),
        'expired-refreshable': _('Sign-in expired, renewed automatically'),
        'expired-external': _('Token expired; run any agy command to refresh'),
        'login-required': _('Sign-in required'),
        'unreadable': _('Credential unreadable'),
        'database-unreadable': _('Database unreadable'),
        'gda-missing': _('Missing Gda 5.0 dependency'),
        'libsecret-missing': _('System keyring or libsecret 1 unavailable'),
    };
    return labels[state];
}
