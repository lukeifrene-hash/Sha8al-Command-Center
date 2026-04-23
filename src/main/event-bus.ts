/**
 * Sha8al Command Center — Event Bus
 *
 * Typed event bus for real-time communication between main and renderer.
 * Replaces the fs.watch-based sync with a proper event-driven architecture.
 *
 * Events flow:
 *   Main → Renderer: ipcMain.emit('bus:emit', event)
 *   Renderer → Main: ipcRenderer.invoke('bus:dispatch', event)
 */

import { EventEmitter } from 'events'
import type { BrowserWindow } from 'electron'

// ─── Event Types ───────────────────────────────────────────────────────────

export type Sha8alEvent =
  | { type: 'task:started'; payload: { taskId: string; agentId: string; timestamp: string } }
  | { type: 'task:completed'; payload: { taskId: string; agentId: string; summary: string; timestamp: string } }
  | { type: 'task:blocked'; payload: { taskId: string; reason: string; timestamp: string } }
  | { type: 'task:unblocked'; payload: { taskId: string; resolution: string; timestamp: string } }
  | { type: 'milestone:audited'; payload: { milestoneId: string; verdict: 'pass' | 'pass_with_notes' | 'fail'; timestamp: string } }
  | { type: 'agent:spawned'; payload: { executionId: string; agentId: string; taskId: string | null } }
  | { type: 'agent:output'; payload: { executionId: string; chunk: string; stream: 'stdout' | 'stderr' } }
  | { type: 'agent:finished'; payload: { executionId: string; status: 'completed' | 'failed' | 'aborted'; exitCode: number | null } }
  | { type: 'wave:started'; payload: { waveId: string; milestoneId: string } }
  | { type: 'wave:completed'; payload: { waveId: string; milestoneId: string } }
  | { type: 'wave:failed'; payload: { waveId: string; reason: string } }
  | { type: 'tracker:mutated'; payload: { mutationType: string; affectedIds: string[]; timestamp: string } }
  | { type: 'sync:requested'; payload: { reason: string } }
  | { type: 'sync:completed'; payload: { success: boolean; error?: string } }
  | { type: 'git:committed'; payload: { branch: string; filesChanged: number; message: string } }
  | { type: 'notification'; payload: { level: 'info' | 'warning' | 'error'; message: string; source: string } }

// ─── Event Bus ───────────────────────────────────────────────────────────────

class EventBus extends EventEmitter {
  private windows: Set<BrowserWindow> = new Set()

  registerWindow(win: BrowserWindow): void {
    this.windows.add(win)
    win.on('closed', () => this.windows.delete(win))
  }

  unregisterWindow(win: BrowserWindow): void {
    this.windows.delete(win)
  }

  /**
   * Emit an event to all registered renderer windows.
   */
  emitToRenderers(event: Sha8alEvent): void {
    const payload = JSON.stringify(event)
    for (const win of this.windows) {
      if (!win.isDestroyed() && win.webContents) {
        win.webContents.send('sha8al:event', payload)
      }
    }
    // Also emit locally for main-process listeners
    this.emit(event.type, event.payload)
  }

  /**
   * Handle an event dispatched from the renderer process.
   */
  dispatchFromRenderer(event: Sha8alEvent): void {
    // Emit locally for main-process listeners
    this.emit(event.type, event.payload)
    // Optionally broadcast to other windows
    this.emitToRenderers(event)
  }
}

export const eventBus = new EventBus()

// ─── Convenience Emitters ───────────────────────────────────────────────────

export function emitTaskStarted(taskId: string, agentId: string): void {
  eventBus.emitToRenderers({
    type: 'task:started',
    payload: { taskId, agentId, timestamp: new Date().toISOString() },
  })
}

export function emitTaskCompleted(taskId: string, agentId: string, summary: string): void {
  eventBus.emitToRenderers({
    type: 'task:completed',
    payload: { taskId, agentId, summary, timestamp: new Date().toISOString() },
  })
}

export function emitTaskBlocked(taskId: string, reason: string): void {
  eventBus.emitToRenderers({
    type: 'task:blocked',
    payload: { taskId, reason, timestamp: new Date().toISOString() },
  })
}

export function emitAgentSpawned(executionId: string, agentId: string, taskId: string | null): void {
  eventBus.emitToRenderers({
    type: 'agent:spawned',
    payload: { executionId, agentId, taskId },
  })
}

export function emitAgentOutput(executionId: string, chunk: string, stream: 'stdout' | 'stderr'): void {
  eventBus.emitToRenderers({
    type: 'agent:output',
    payload: { executionId, chunk, stream },
  })
}

export function emitAgentFinished(executionId: string, status: 'completed' | 'failed' | 'aborted', exitCode: number | null): void {
  eventBus.emitToRenderers({
    type: 'agent:finished',
    payload: { executionId, status, exitCode },
  })
}

export function emitWaveStarted(waveId: string, milestoneId: string): void {
  eventBus.emitToRenderers({
    type: 'wave:started',
    payload: { waveId, milestoneId },
  })
}

export function emitWaveCompleted(waveId: string, milestoneId: string): void {
  eventBus.emitToRenderers({
    type: 'wave:completed',
    payload: { waveId, milestoneId },
  })
}

export function emitWaveFailed(waveId: string, reason: string): void {
  eventBus.emitToRenderers({
    type: 'wave:failed',
    payload: { waveId, reason },
  })
}

export function emitTrackerMutated(mutationType: string, affectedIds: string[]): void {
  eventBus.emitToRenderers({
    type: 'tracker:mutated',
    payload: { mutationType, affectedIds, timestamp: new Date().toISOString() },
  })
}

export function emitNotification(level: 'info' | 'warning' | 'error', message: string, source: string): void {
  eventBus.emitToRenderers({
    type: 'notification',
    payload: { level, message, source },
  })
}
