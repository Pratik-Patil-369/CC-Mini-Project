import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Problem {
  id: number
  title: string
  difficulty: string
  description: string
  testCaseCount: number
}

export default function ProblemList() {
  const [problems, setProblems] = useState<Problem[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/problems')
      .then(res => res.json())
      .then(setProblems)
      .catch(console.error)
  }, [])

  const easyCount = problems.filter(p => p.difficulty === 'Easy').length
  const mediumCount = problems.filter(p => p.difficulty === 'Medium').length

  return (
    <div className="min-h-screen bg-background dark">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold">
              ⚡
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
              CodeForge
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-[11px] gap-1.5">
              ☁️ Cloud Powered
            </Badge>
            <Badge variant="outline" className="text-[11px] gap-1.5">
              🐳 Docker Sandbox
            </Badge>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-8">
        <h1 className="text-3xl font-bold mb-2">Problems</h1>
        <p className="text-muted-foreground text-sm">
          Solve coding challenges — your code runs in isolated Docker containers.
        </p>
      </div>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Problems', value: problems.length, color: 'text-foreground' },
            { label: 'Easy', value: easyCount, color: 'text-emerald-400' },
            { label: 'Medium', value: mediumCount, color: 'text-amber-400' },
            { label: 'Languages', value: 4, color: 'text-blue-400' },
          ].map(stat => (
            <Card key={stat.label} className="py-4">
              <CardContent className="pb-0">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Problem Table */}
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <Card className="py-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-32">Difficulty</TableHead>
                <TableHead className="w-32 text-right">Test Cases</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problems.map(p => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/problem/${p.id}`)}
                >
                  <TableCell className="font-medium text-muted-foreground">
                    {p.id}
                  </TableCell>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        p.difficulty === 'Easy'
                          ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
                          : 'text-amber-400 border-amber-400/30 bg-amber-400/10'
                      }
                    >
                      {p.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {p.testCaseCount} cases
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* How It Works */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-lg font-semibold mb-4">How It Works</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              icon: '📝',
              title: 'Write Code',
              desc: 'Choose from Python, C++, Java, or JavaScript. Write your solution in the Monaco editor.',
            },
            {
              icon: '🐳',
              title: 'Docker Execution',
              desc: 'Code runs in isolated containers with resource limits — no network, capped CPU & memory.',
            },
            {
              icon: '✅',
              title: 'Judge Results',
              desc: 'Output is compared against multiple test cases. See pass/fail per case with expected vs actual.',
            },
          ].map(item => (
            <Card key={item.title} className="py-5">
              <CardContent className="pb-0">
                <div className="text-2xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
