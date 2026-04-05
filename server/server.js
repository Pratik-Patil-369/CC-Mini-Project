const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

// ─── Load Problems ───────────────────────────────────────────────────
const problems = JSON.parse(
  fs.readFileSync(path.join(__dirname, "problems.json"), "utf-8")
);

// ─── SQLite Database Setup ───────────────────────────────────────────
const db = new Database(path.join(__dirname, "submissions.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id INTEGER NOT NULL,
    language TEXT NOT NULL,
    code TEXT NOT NULL,
    status TEXT NOT NULL,
    passed INTEGER NOT NULL,
    total INTEGER NOT NULL,
    results TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

console.log("✅ SQLite database ready (submissions.db)");

// Prepared statements
const insertSubmission = db.prepare(`
  INSERT INTO submissions (problem_id, language, code, status, passed, total, results)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const getSubmissions = db.prepare(`
  SELECT id, problem_id, language, status, passed, total, created_at
  FROM submissions
  WHERE problem_id = ?
  ORDER BY created_at DESC
`);

const getSubmissionById = db.prepare(`
  SELECT * FROM submissions WHERE id = ?
`);

// ─── Express Setup ───────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Serve React build from ../client/dist
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));

// ─── Docker Config ───────────────────────────────────────────────────
const DOCKER_IMAGES = {
  python: "python:3.9-alpine",
  cpp: "gcc:latest",
  java: "eclipse-temurin:17-alpine",
  javascript: "node:22-alpine",
};

const FILE_EXTENSIONS = {
  python: "py",
  cpp: "cpp",
  java: "java",
  javascript: "js",
};

const TIMEOUT_MS = 15000;

// ─── Execution Engine ────────────────────────────────────────────────
// When running inside Docker, the -v mount path must be the HOST path.
// Set HOST_TEMP_DIR env var to the host-side temp directory.
const tempDir = path.join(__dirname, "temp");
const hostTempDir = process.env.HOST_TEMP_DIR || tempDir;

const executeCode = (language, code, input) => {
  return new Promise((resolve) => {
    const jobId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const ext = FILE_EXTENSIONS[language];
    const fileName = `job_${jobId}.${ext}`;
    const inputFile = `input_${jobId}.txt`;
    const codePath = path.join(tempDir, fileName);
    const inputPath = path.join(tempDir, inputFile);

    fs.writeFileSync(codePath, code);
    fs.writeFileSync(inputPath, input);

    const image = DOCKER_IMAGES[language];
    let command = "";

    // Security flags: no network, resource limits, auto-cleanup
    const dockerFlags = `--rm --network=none --memory=128m --cpus=0.5`;

    if (language === "python") {
      command = `docker run ${dockerFlags} -v "${hostTempDir}:/app" ${image} sh -c "python /app/${fileName} < /app/${inputFile}"`;
    } else if (language === "cpp") {
      command = `docker run ${dockerFlags} -v "${hostTempDir}:/app" ${image} sh -c "g++ /app/${fileName} -o /app/out_${jobId} && /app/out_${jobId} < /app/${inputFile}"`;
    } else if (language === "java") {
      command = `docker run ${dockerFlags} -v "${hostTempDir}:/app" ${image} sh -c "cp /app/${fileName} /app/Main.java && javac /app/Main.java && java -cp /app Main < /app/${inputFile}"`;
    } else if (language === "javascript") {
      command = `docker run ${dockerFlags} -v "${hostTempDir}:/app" ${image} sh -c "node /app/${fileName} < /app/${inputFile}"`;
    } else {
      return resolve({ success: false, error: "Unsupported language" });
    }

    console.log(`[DOCKER] Running ${language} job: ${jobId}`);

    const process = exec(command, { timeout: TIMEOUT_MS }, (error, stdout, stderr) => {
      // Cleanup temp files
      try {
        if (fs.existsSync(codePath)) fs.unlinkSync(codePath);
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (language === "cpp") {
          const exePath = path.join(tempDir, `out_${jobId}`);
          if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
        }
        if (language === "java") {
          const classPath = path.join(tempDir, "Main.java");
          const classFile = path.join(tempDir, "Main.class");
          if (fs.existsSync(classPath)) fs.unlinkSync(classPath);
          if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
        }
      } catch (e) { /* ignore cleanup errors */ }

      if (error) {
        if (error.killed) {
          resolve({ success: false, error: "Time Limit Exceeded (15s)" });
        } else {
          resolve({ success: false, error: stderr || error.message });
        }
      } else {
        resolve({ success: true, output: stdout.trim() });
      }
    });
  });
};

// ─── Judge Engine ────────────────────────────────────────────────────
const judgeCode = async (language, code, problem) => {
  const results = [];
  let passedCount = 0;

  for (let i = 0; i < problem.testCases.length; i++) {
    const tc = problem.testCases[i];
    const result = await executeCode(language, code, tc.input);

    if (!result.success) {
      results.push({ case: i + 1, status: "Error", output: result.error });
    } else {
      const cleanOutput = result.output.replace(/\r\n/g, "\n").trim();
      const cleanExpected = tc.expected.replace(/\r\n/g, "\n").trim();

      if (cleanOutput === cleanExpected) {
        passedCount++;
        results.push({ case: i + 1, status: "Passed", output: cleanOutput });
      } else {
        results.push({
          case: i + 1,
          status: "Failed",
          output: cleanOutput,
          expected: cleanExpected,
        });
      }
    }
  }

  let status;
  if (passedCount === problem.testCases.length) {
    status = "Accepted";
  } else if (passedCount > 0) {
    status = "Partially Accepted";
  } else {
    status = "Rejected";
  }

  return { status, passed: passedCount, total: problem.testCases.length, results };
};

// ─── API: List all problems ─────────────────────────────────────────
app.get("/problems", (req, res) => {
  const safeProblems = problems.map(({ testCases, ...rest }) => ({
    ...rest,
    testCaseCount: testCases.length,
  }));
  res.json(safeProblems);
});

// ─── API: Get single problem ────────────────────────────────────────
app.get("/problems/:id", (req, res) => {
  const problem = problems.find((p) => p.id === parseInt(req.params.id));
  if (!problem) return res.status(404).json({ error: "Problem not found" });

  const { testCases, ...rest } = problem;
  res.json({ ...rest, testCaseCount: testCases.length });
});

// ─── API: Run code (stateless) ──────────────────────────────────────
app.post("/run", async (req, res) => {
  const { language, code, problemId } = req.body;

  if (!language || !code || !problemId) {
    return res.status(400).json({ error: "Missing language, code, or problemId" });
  }
  if (!DOCKER_IMAGES[language]) {
    return res.status(400).json({ error: `Unsupported language: ${language}` });
  }

  const problem = problems.find((p) => p.id === parseInt(problemId));
  if (!problem) return res.status(404).json({ error: "Problem not found" });

  try {
    const verdict = await judgeCode(language, code, problem);
    res.json(verdict);
  } catch (err) {
    console.error("[ERROR]", err);
    res.status(500).json({ error: err.toString() });
  }
});

// ─── API: Submit code (saves to SQLite) ─────────────────────────────
app.post("/submit", async (req, res) => {
  const { language, code, problemId } = req.body;

  if (!language || !code || !problemId) {
    return res.status(400).json({ error: "Missing language, code, or problemId" });
  }
  if (!DOCKER_IMAGES[language]) {
    return res.status(400).json({ error: `Unsupported language: ${language}` });
  }

  const problem = problems.find((p) => p.id === parseInt(problemId));
  if (!problem) return res.status(404).json({ error: "Problem not found" });

  try {
    const verdict = await judgeCode(language, code, problem);

    const info = insertSubmission.run(
      problem.id,
      language,
      code,
      verdict.status,
      verdict.passed,
      verdict.total,
      JSON.stringify(verdict.results)
    );

    console.log(`[DB] Submission #${info.lastInsertRowid} saved — ${verdict.status}`);

    res.json({ ...verdict, submissionId: info.lastInsertRowid });
  } catch (err) {
    console.error("[ERROR]", err);
    res.status(500).json({ error: err.toString() });
  }
});

// ─── API: Get submissions for a problem ─────────────────────────────
app.get("/submissions/:problemId", (req, res) => {
  try {
    const rows = getSubmissions.all(parseInt(req.params.problemId));
    res.json(rows);
  } catch (err) {
    console.error("[ERROR]", err);
    res.status(500).json({ error: err.toString() });
  }
});

// ─── API: Get single submission details ─────────────────────────────
app.get("/submission/:id", (req, res) => {
  try {
    const row = getSubmissionById.get(parseInt(req.params.id));
    if (!row) return res.status(404).json({ error: "Submission not found" });

    res.json({ ...row, results: JSON.parse(row.results) });
  } catch (err) {
    console.error("[ERROR]", err);
    res.status(500).json({ error: err.toString() });
  }
});

// ─── Serve React App (catch-all) ────────────────────────────────────
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

// ─── Start Server ───────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 CodeForge Server running on http://localhost:${PORT}`);
  console.log(`📝 Loaded ${problems.length} problems`);
  console.log(`🐳 Languages: ${Object.keys(DOCKER_IMAGES).join(", ")}`);

  const count = db.prepare("SELECT COUNT(*) as count FROM submissions").get();
  console.log(`💾 Total submissions in DB: ${count.count}\n`);
});
