import nunjucks from 'nunjucks'

// JSON for a <script type="application/json"> block. Escaping < stops a value ending the block early.
export function jsonIsland(value) {
  return new nunjucks.runtime.SafeString(
    JSON.stringify(value ?? null).replaceAll('<', '\\u003c')
  )
}
