// Lets overlays (dialogs) claim the Android hardware back button while they are open.
type Handler = () => void
const stack: Handler[] = []

/** Registers a handler for the back button. Returns an unregister function. */
export function pushBackHandler(handler: Handler): () => void {
  stack.push(handler)
  return () => {
    const index = stack.lastIndexOf(handler)
    if (index >= 0) stack.splice(index, 1)
  }
}

/** Runs the top-most handler. Returns false when nothing claimed the event. */
export function runBackHandler(): boolean {
  const top = stack[stack.length - 1]
  if (!top) return false
  top()
  return true
}
