// Lists every request the web app makes through `apiClient` (get/post/put/patch/delete), read from the real syntax
// tree, as JSON on stdout: [{ verb, path, file, line, dynamic }]. `path` is relative to the API's base address,
// with every ${...} replaced by :param and any query string removed. A call whose path is not written out in the
// source (a variable, or a template that starts with one) has `dynamic: true` and no path, so it is never skipped
// silently. Used by `bin/rails web:check_routes`, which compares the list with the routes Rails has.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const VERBS = new Set(['get', 'post', 'put', 'patch', 'delete'])
// `node list-api-calls.mjs [folder]`: the web app's own src folder unless another is given (the specs do).
const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = process.argv[2] ? resolve(process.argv[2]) : join(appRoot, 'src')
const root = process.argv[2] ? srcDir : appRoot

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'test' ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts') ? [path] : []
  })
}

// The text of a path argument with each ${...} as :param, or null when it is not written out.
function pathText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) {
    if (node.head.text === '') return null // starts with a variable: the path is not in the source
    return node.head.text + node.templateSpans.map((span) => `:param${span.literal.text}`).join('')
  }
  return null
}

// Functions that build an address from their arguments. Each call of one with written-out arguments is listed as the
// request it makes, so the real address is checked (the one place that builds it, inside the wrapper, is a dynamic
// call that has to be allowed with a reason).
const WRAPPERS = {
  // exportReport('work_orders/summary', 'csv', params) asks for GET /reports/work_orders/summary.csv
  exportReport: { verb: 'get', build: ([report, format]) => `/reports/${report}.${format}` },
}

const calls = []
for (const file of sourceFiles(srcDir)) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'apiClient' &&
      VERBS.has(node.expression.name.text)
    ) {
      const arg = node.arguments[0]
      const text = arg ? pathText(arg) : null
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1
      calls.push({
        verb: node.expression.name.text,
        path: text === null ? null : text.split('?')[0],
        file: relative(root, file),
        line,
        dynamic: text === null,
      })
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && WRAPPERS[node.expression.text]) {
      const wrapper = WRAPPERS[node.expression.text]
      const args = node.arguments.slice(0, 2).map((arg) => (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg) ? arg.text : null))
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1
      const known = args.length === 2 && args.every((arg) => arg !== null)
      calls.push({
        verb: wrapper.verb, path: known ? wrapper.build(args) : null, file: relative(root, file), line, dynamic: !known,
        via: node.expression.text,
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

calls.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
process.stdout.write(JSON.stringify(calls, null, 2))
