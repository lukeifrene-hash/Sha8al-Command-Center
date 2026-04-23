import { loadTrackerFromWorkspace, useStore } from '../store'

async function activateWorkspace() {
  const result = await window.api.workspace.generateTracker()
  useStore.getState().setWorkspaceStatus(result.status)
  await loadTrackerFromWorkspace()
}

export function OnboardingView() {
  const { workspaceStatus, loading, error, setLoading, setError, setTracker, setWorkspaceStatus } = useStore()

  async function withAction(action: () => Promise<void>) {
    setLoading(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const projectRoot = workspaceStatus?.projectRoot
  const roadmapExists = Boolean(workspaceStatus?.roadmapExists)
  const trackerExists = Boolean(workspaceStatus?.trackerExists)

  return (
    <div className="h-screen bg-dark text-white flex items-center justify-center px-6">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-panel/80 p-8">
        <div className="mb-8">
          <p className="text-xs font-mono tracking-[0.2em] text-accent uppercase mb-3">
            Sha8al Command Center
          </p>
          <h1 className="text-3xl font-semibold mb-3">Activate this workspace with a roadmap</h1>
          <p className="text-sm text-muted leading-6 max-w-2xl">
            The app only gates on <code className="text-accent font-mono">docs/roadmap.md</code>.
            Choose a project folder, import an existing roadmap, or create a starter roadmap and the tracker will be generated automatically.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <div className="rounded-xl border border-border bg-dark/60 p-5">
            <h2 className="text-sm font-semibold mb-2">1. Choose Project Folder</h2>
            <p className="text-sm text-muted mb-4">
              Point Command Center at the repo you want to drive.
            </p>
              <button
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                disabled={loading}
                onClick={() => withAction(async () => {
                  const result = await window.api.workspace.chooseProjectFolder()
                  setWorkspaceStatus(result.status)
                  setTracker(null)
                  if (result.canceled) return
                  if (result.status.trackerExists) {
                    await loadTrackerFromWorkspace()
                  } else if (result.status.roadmapExists) {
                    await activateWorkspace()
                  }
                })}
              >
              {projectRoot ? 'Choose Different Folder' : 'Choose Folder'}
            </button>
            {projectRoot && (
              <p className="mt-3 text-xs font-mono text-muted break-all">{projectRoot}</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-dark/60 p-5">
            <h2 className="text-sm font-semibold mb-2">2. Add roadmap.md</h2>
            <p className="text-sm text-muted mb-4">
              Use an existing roadmap or let the app scaffold a starter roadmap and manifesto.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                disabled={!projectRoot || loading}
                onClick={() => withAction(async () => {
                  const result = await window.api.workspace.importRoadmap()
                  setWorkspaceStatus(result.status)
                  if (!result.canceled) {
                    await activateWorkspace()
                  }
                })}
              >
                Import roadmap.md
              </button>
              <button
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                disabled={!projectRoot || loading}
                onClick={() => withAction(async () => {
                  const result = await window.api.workspace.createStarterRoadmap()
                  setWorkspaceStatus(result.status)
                  await activateWorkspace()
                })}
              >
                Create roadmap.md
              </button>
              <button
                className="rounded-md border border-accent/40 px-4 py-2 text-sm font-semibold text-accent disabled:opacity-50"
                disabled={!projectRoot || !roadmapExists || trackerExists || loading}
                onClick={() => withAction(async () => {
                  await activateWorkspace()
                })}
              >
                Activate Command Center
              </button>
            </div>
            {roadmapExists && (
              <p className="mt-3 text-xs text-emerald-300">
                Roadmap detected. The next activation will populate the dashboard.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-dark/60 p-5">
          <h2 className="text-sm font-semibold mb-3">How it works</h2>
          <pre className="overflow-x-auto text-xs leading-6 text-muted font-mono">
{`project folder
    │
    ├─ docs/roadmap.md exists ───────► generate tracker ───────► open dashboard
    │
    └─ docs/roadmap.md missing
           ├─ import roadmap.md ─────► generate tracker ───────► open dashboard
           └─ create roadmap.md
                + manifesto.md ──────► generate tracker ───────► open dashboard`}
          </pre>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
