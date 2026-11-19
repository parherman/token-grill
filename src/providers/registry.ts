import type {ProviderKind} from '../core/types.js';
import {AntigravityCollector} from './antigravity/collector.js';
import type {ProviderCollector} from './base.js';
import {ClaudeCollector} from './claude/collector.js';
import {CodexCollector} from './codex/collector.js';
import {CopilotCollector} from './copilot/collector.js';
import {CursorCollector} from './cursor/collector.js';
import {DeepSeekCollector} from './deepseek/collector.js';
import {KimiCollector} from './kimi/collector.js';
import {KiroCollector} from './kiro/collector.js';
import {OpenCodeGoCollector} from './opencode-go/collector.js';

// Collectors hold only in-memory token caches, so they are released by dropping them.
export function createCollectors(): Record<ProviderKind, ProviderCollector> {
    return {
        codex: new CodexCollector(),
        claude: new ClaudeCollector(),
        kiro: new KiroCollector(),
        antigravity: new AntigravityCollector(),
        'copilot': new CopilotCollector(),
        'opencode-go': new OpenCodeGoCollector(),
        'deepseek': new DeepSeekCollector(),
        'kimi': new KimiCollector(),
        cursor: new CursorCollector(),
    };
}
