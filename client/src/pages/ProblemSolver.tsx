import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Problem {
  id: number
  title: string
  difficulty: string
  description: string
  sampleInput: string
  sampleOutput: string
  testCaseCount: number
}

interface TestResult {
  case: number
  status: string
  output: string
  expected?: string
}

interface RunResponse {
  status: string
  passed: number
  total: number
  results: TestResult[]
  submissionId?: number
}

interface Submission {
  id: number
  problem_id: number
  language: string
  status: string
  passed: number
  total: number
  created_at: string
}

const STARTER_CODE: Record<string, string> = {
  python: '# Write your solution here\n\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
  java: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        \n    }\n}\n',
  javascript: 'const readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\nconst lines = [];\nrl.on("line", l => lines.push(l));\nrl.on("close", () => {\n    \n});\n',
}

const MONACO_LANGS: Record<string, string> = {
  python: 'python',
  cpp: 'cpp',
  java: 'java',
  javascript: 'javascript',
}

const DOCKER_IMAGES: Record<string, string> = {
  python: 'python:3.9-alpine',
  cpp: 'gcc:latest',
  java: 'openjdk:17-alpine',
  javascript: 'node:18-alpine',
}

const LANG_LABELS: Record<string, string> = {
  python: 'Python 3',
  cpp: 'C++',
  java: 'Java',
  javascript: 'JavaScript',
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr + 'Z') // treat as UTC
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

export default function ProblemSolver() {
  const { id } = useParams<{ id: string }>()
  const [problem, setProblem] = useState<Problem | null>(null)
  const [language, setLanguage] = useState('python')
  const [results, setResults] = useState<RunResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'description' | 'submissions'>('description')
  const [resultTab, setResultTab] = useState<'testcases' | 'output'>('testcases')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const editorRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [leftWidth, setLeftWidth] = useState(45)
  const isResizing = useRef(false)

  // Load problem
  useEffect(() => {
    fetch(`/problems/${id}`)
      .then(res => res.json())
      .then(setProblem)
      .catch(console.error)
  }, [id])

  // Load submissions when tab switches or after a new submit
  const loadSubmissions = useCallback(() => {
    if (!id) return
    setLoadingSubmissions(true)
    fetch(`/submissions/${id}`)
      .then(res => res.json())
      .then(data => {
        setSubmissions(data)
        setLoadingSubmissions(false)
      })
      .catch(() => setLoadingSubmissions(false))
  }, [id])

  useEffect(() => {
    if (activeTab === 'submissions') {
      loadSubmissions()
    }
  }, [activeTab, loadSubmissions])

  const handleEditorMount = (editor: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    editorRef.current = editor
  }

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value)
  }

  // Run (stateless — no DB save)
  const runCode = useCallback(async () => {
    if (!problem || !editorRef.current) return
    const code = editorRef.current.getValue()

    setRunning(true)
    setResultTab('testcases')

    try {
      const res = await fetch('/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, problemId: problem.id }),
      })
      const data: RunResponse = await res.json()
      setResults(data)
    } catch {
      setResults({
        status: 'Rejected',
        passed: 0,
        total: problem.testCaseCount,
        results: [{ case: 1, status: 'Error', output: 'Server connection failed' }],
      })
    }

    setRunning(false)
  }, [language, problem])

  // Submit (saves to database)
  const submitCode = useCallback(async () => {
    if (!problem || !editorRef.current) return
    const code = editorRef.current.getValue()

    setSubmitting(true)
    setResultTab('testcases')

    try {
      const res = await fetch('/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, problemId: problem.id }),
      })
      const data: RunResponse = await res.json()
      setResults(data)

      // Refresh submissions list
      loadSubmissions()
    } catch {
      setResults({
        status: 'Rejected',
        passed: 0,
        total: problem.testCaseCount,
        results: [{ case: 1, status: 'Error', output: 'Server connection failed' }],
      })
    }

    setSubmitting(false)
  }, [language, problem, loadSubmissions])

  // Keyboard shortcut: Ctrl+Enter = Run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        runCode()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [runCode])

  // Resizer
  const handleMouseDown = () => {
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const pct = (e.clientX / window.innerWidth) * 100
      if (pct > 20 && pct < 70) setLeftWidth(pct)
    }
    const handleMouseUp = () => {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const isProcessing = running || submitting

  if (!problem) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Nav */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
        <div className="px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                ⚡
              </div>
              <span className="text-sm font-bold bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
                CodeForge
              </span>
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm font-medium">{problem.id}. {problem.title}</span>
            <Badge
              variant="outline"
              className={
                problem.difficulty === 'Easy'
                  ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
                  : 'text-amber-400 border-amber-400/30 bg-amber-400/10'
              }
            >
              {problem.difficulty}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={handleLanguageChange}
              className="text-xs font-medium px-3 py-1.5 bg-secondary text-foreground border border-border rounded-md cursor-pointer outline-none hover:border-ring transition-colors"
            >
              <option value="python">Python 3</option>
              <option value="cpp">C++ (GCC)</option>
              <option value="java">Java 17</option>
              <option value="javascript">JavaScript</option>
            </select>
            <Button
              size="sm"
              onClick={runCode}
              disabled={isProcessing}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
            >
              {running ? '⏳ Running...' : '▶ Run'}
            </Button>
            <Button
              size="sm"
              onClick={submitCode}
              disabled={isProcessing}
              className="gap-1.5"
            >
              {submitting ? '⏳ Judging...' : '⬆ Submit'}
            </Button>
          </div>
        </div>
      </nav>

      {/* Split Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Problem Description / Submissions */}
        <div className="flex flex-col overflow-hidden" style={{ width: `${leftWidth}%` }}>
          {/* Tabs */}
          <div className="border-b border-border bg-card/50 px-2 py-1 shrink-0">
            <TabsList className="h-8">
              <TabsTrigger
                active={activeTab === 'description'}
                onClick={() => setActiveTab('description')}
                className="text-xs"
              >
                Description
              </TabsTrigger>
              <TabsTrigger
                active={activeTab === 'submissions'}
                onClick={() => setActiveTab('submissions')}
                className="text-xs"
              >
                Submissions
                {submissions.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
                    {submissions.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'description' ? (
              <>
                <h1 className="text-xl font-bold mb-4">
                  {problem.id}. {problem.title}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {problem.description}
                </p>

                <div className="space-y-4">
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Example Input
                    </div>
                    <pre className="bg-secondary/80 border border-border rounded-lg px-4 py-3 font-mono text-sm text-emerald-400 overflow-x-auto">
                      {problem.sampleInput}
                    </pre>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Example Output
                    </div>
                    <pre className="bg-secondary/80 border border-border rounded-lg px-4 py-3 font-mono text-sm text-emerald-400 overflow-x-auto">
                      {problem.sampleOutput}
                    </pre>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-secondary/50 border border-border rounded-lg">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Constraints
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Time limit: 15 seconds</li>
                    <li>• Memory limit: 128 MB</li>
                    <li>• {problem.testCaseCount} test cases</li>
                    <li>• Network access: disabled</li>
                  </ul>
                </div>
              </>
            ) : (
              /* ─── Submissions Tab ─── */
              <div>
                <h2 className="text-lg font-semibold mb-4">Submission History</h2>
                {loadingSubmissions ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    <div className="w-5 h-5 border-2 border-border border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                    Loading...
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-12">
                    <div className="text-3xl mb-3 opacity-50">📋</div>
                    <p>No submissions yet.</p>
                    <p className="text-xs mt-1">Click <strong>Submit</strong> to save your solution.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {submissions.map(sub => (
                      <div
                        key={sub.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          sub.status === 'Accepted'
                            ? 'border-emerald-500/20 bg-emerald-500/5'
                            : sub.status === 'Partially Accepted'
                              ? 'border-amber-500/20 bg-amber-500/5'
                              : 'border-red-500/20 bg-red-500/5'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`text-sm font-semibold ${
                              sub.status === 'Accepted'
                                ? 'text-emerald-400'
                                : sub.status === 'Partially Accepted'
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                            }`}
                          >
                            {sub.status === 'Accepted'
                              ? '✅'
                              : sub.status === 'Partially Accepted'
                                ? '⚠️'
                                : '❌'}{' '}
                            {sub.status}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            #{sub.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{LANG_LABELS[sub.language] || sub.language}</span>
                          <span>•</span>
                          <span>{sub.passed}/{sub.total} passed</span>
                          <span>•</span>
                          <span>{timeAgo(sub.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Resizer */}
        <div
          className="w-1 cursor-col-resize bg-border hover:bg-blue-500 transition-colors shrink-0"
          onMouseDown={handleMouseDown}
        />

        {/* RIGHT: Editor + Results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor */}
          <div className="flex-1 min-h-0">
            <Editor
              defaultLanguage="python"
              language={MONACO_LANGS[language]}
              defaultValue={STARTER_CODE.python}
              value={STARTER_CODE[language]}
              theme="vs-dark"
              onMount={handleEditorMount}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                padding: { top: 14, bottom: 14 },
                scrollBeyondLastLine: false,
                renderLineHighlight: 'gutter',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                lineNumbersMinChars: 3,
              }}
            />
          </div>

          {/* Results */}
          <div className="border-t border-border shrink-0" style={{ height: 200 }}>
            <div className="flex items-center justify-between border-b border-border bg-card/50 px-4 py-1">
              <TabsList className="h-7">
                <TabsTrigger
                  active={resultTab === 'testcases'}
                  onClick={() => setResultTab('testcases')}
                  className="text-[11px]"
                >
                  Test Cases
                </TabsTrigger>
                <TabsTrigger
                  active={resultTab === 'output'}
                  onClick={() => setResultTab('output')}
                  className="text-[11px]"
                >
                  Output
                </TabsTrigger>
              </TabsList>
              {results && (
                <span
                  className={`text-xs font-semibold ${
                    results.status === 'Accepted'
                      ? 'text-emerald-400'
                      : results.status === 'Partially Accepted'
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`}
                >
                  {results.status === 'Accepted' ? '✅' : results.status === 'Partially Accepted' ? '⚠️' : '❌'}{' '}
                  {results.status} — {results.passed}/{results.total} passed
                  {results.submissionId && (
                    <span className="text-muted-foreground ml-2">
                      (Submission #{results.submissionId})
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="overflow-y-auto h-[calc(100%-36px)] p-3">
              {resultTab === 'testcases' ? (
                !results ? (
                  <div className="text-center text-muted-foreground text-xs py-6">
                    <span className="text-lg block mb-2 opacity-40">🚀</span>
                    Click <strong>Run</strong> or press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">Ctrl+Enter</kbd> to test
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {results.results.map(r => (
                      <div
                        key={r.case}
                        className={`border rounded-lg p-3 ${
                          r.status === 'Passed'
                            ? 'border-emerald-500/20 bg-emerald-500/5'
                            : r.status === 'Failed'
                              ? 'border-red-500/20 bg-red-500/5'
                              : 'border-orange-500/20 bg-orange-500/5'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Case {r.case}
                          </span>
                          <span
                            className={`text-[11px] font-semibold ${
                              r.status === 'Passed'
                                ? 'text-emerald-400'
                                : r.status === 'Failed'
                                  ? 'text-red-400'
                                  : 'text-orange-400'
                            }`}
                          >
                            {r.status === 'Passed' ? '✅' : r.status === 'Failed' ? '❌' : '⚠️'}{' '}
                            {r.status}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] leading-relaxed">
                          {r.status === 'Passed' ? (
                            <>
                              <span className="text-muted-foreground">Output: </span>
                              <span className="text-emerald-400">{r.output}</span>
                            </>
                          ) : r.status === 'Failed' ? (
                            <>
                              <span className="text-muted-foreground">Expected: </span>
                              {r.expected}
                              <br />
                              <span className="text-muted-foreground">Got: </span>
                              <span className="text-red-400">{r.output}</span>
                            </>
                          ) : (
                            <span className="text-orange-400">{r.output?.slice(0, 150)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                  {results
                    ? results.results.map(r => `Case ${r.case}: ${r.output}`).join('\n')
                    : 'No output yet.'}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl p-8 text-center shadow-2xl">
            <div className="w-8 h-8 border-2 border-border border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <div className="text-sm font-medium">
              {submitting ? 'Submitting & Judging' : 'Executing in Docker'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {submitting ? 'Saving to database...' : DOCKER_IMAGES[language]}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
