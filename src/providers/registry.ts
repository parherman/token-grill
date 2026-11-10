import type {ProviderKind} from '../core/types.js';
import {AntigravityCollector} from './antigravity/collector.js';
import type {ProviderCollector} from './base.js';
import {ClaudeCollector} from './claude/collector.js';
import {CodexCollector} from './codex/collector.js';
import {CursorCollector} from './cursor/collector.js';
import {KiroCollector} from './kiro/collector.js';

// Collectors hold only in-memory token caches, so they are released by dropping them.
export function createCollectors(): Record<ProviderKind, ProviderCollector> {
    return {
        codex: new CodexCollector(),
        claude: new ClaudeCollector(),
        kiro: new KiroCollector(),
        antigravity: new AntigravityCollector(),
        cursor: new CursorCollector(),
    };
}
