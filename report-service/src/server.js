import express from "express";
import pkg from "pg";
import bodyParser from "body-parser";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pkg;
const app = express();
const port = 3000;

// Necessário pq está usando ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// habilita arquivos estáticos (CSS, imagens etc) em /src/public
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// para ler dados de formulário
app.use(bodyParser.urlencoded({ extended: true }));



// conexão banco
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "residencia",
  password: "postgres",
  port: 5432,
});


// rota inicial -> formulário
app.get("/", async (req, res) => {
  try {
    const turmas = await pool.query("SELECT id, nome FROM turmas");
    const professores = await pool.query("SELECT id, nome FROM professores");
    const atividades = await pool.query("SELECT id, nome FROM atividades");

    res.render("index", { turmas: turmas.rows, professores: professores.rows, atividades: atividades.rows });

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao carregar dados");
  }
});

// função util para buscar dados
async function buscarRelatorio(filtros) {
  const { turma_id, professor_id, atividade_id, presenca, conceito, status } = filtros;

  let query = `
    SELECT a.nome AS aluno, a.email, t.nome AS turma, atv.nome AS atividade,
           p.nota, p.conceito, p.presenca, p.horas,
           string_agg(DISTINCT prof.nome, ', ') AS professores
    FROM participacoes p
    JOIN alunos a ON a.id = p.aluno_id
    JOIN turmas t ON t.id = p.turma_id
    JOIN atividades atv ON atv.id = p.atividade_id
    LEFT JOIN professor_turma pt ON pt.turma_id = t.id
    LEFT JOIN professores prof ON prof.id = pt.professor_id
    WHERE t.id = $1
  `;
  const params = [turma_id];
  let paramCount = 2;

  if (professor_id) {
    query += ` AND prof.id = $${paramCount++}`;
    params.push(professor_id);
  }
  if (atividade_id) {
    query += ` AND atv.id = $${paramCount++}`;
    params.push(atividade_id);
  }
  if (presenca) {
    query += ` AND p.presenca = $${paramCount++}`;
    params.push(presenca === "Presente");
  }
  if (conceito) {
    query += ` AND p.conceito = $${paramCount++}`;
    params.push(conceito);
  }

  query += ` GROUP BY a.id, t.id, atv.id, p.id ORDER BY a.nome`;

  const result = await pool.query(query, params);

  result.rows.forEach(r => {
    if (r.nota === null) {
      r.status = "Pendente";
    } else if (r.nota >= 6) {
      r.status = "Aprovado";
    } else {
      r.status = "Reprovado";
    }
  });

  return status ? result.rows.filter(r => r.status === status) : result.rows;
}

// rota relatório html
app.post("/relatorio", async (req, res) => {
  const { turma_id, professor_id, atividade_id, presenca, conceito, tipo, status } = req.body;

  try {
    const rows = await buscarRelatorio({ turma_id, professor_id, atividade_id, presenca, conceito, status });

    const notasValidas = rows
      .map(r => typeof r.nota === "number" ? r.nota : parseFloat(r.nota))
      .filter(n => !Number.isNaN(n));

    const mediaNotas = notasValidas.length
      ? notasValidas.reduce((s, n) => s + n, 0) / notasValidas.length
      : 0;

    const total = rows.length;
    const frequencia = rows.filter(r => r.presenca).length / (total || 1) * 100;
    const aprovados = rows.filter(r => r.status === "Aprovado").length;
    const reprovados = rows.filter(r => r.status === "Reprovado").length;

    res.send(`
      <html>
        <head>
          <link rel="stylesheet" href="/relatorio.css">
          <title>Relatório</title>
          
        </head>
        <body>
          <header>
            <span>📑 Relatório da Turma</span>
            <button class="theme-toggle" onclick="toggleTheme()">🌙</button>
          </header>
          <main>
            ${tipo === "detalhado" ? `
            <div class="stats">
              <div class="card"><b>${total}</b><br/>Total</div>
              <div class="card"><b>${mediaNotas.toFixed(2)}</b><br/>Média Notas</div>
              <div class="card"><b>${frequencia.toFixed(1)}%</b><br/>Frequência</div>
              <div class="card"><b>${aprovados}</b><br/>Aprovados</div>
              <div class="card"><b>${reprovados}</b><br/>Reprovados</div>
            </div>` : ""}

            <table>
              <tr>
                <th>Aluno</th>
                <th>Email</th>
                <th>Turma</th>
                <th>Atividade</th>
                <th>Nota</th>
                <th>Conceito</th>
                <th>Presença</th>
                <th>Horas</th>
                <th>Status</th>
                <th>Professor(es)</th>
              </tr>
              ${rows.map(r => `
                <tr>
                  <td>${r.aluno}</td>
                  <td>${r.email}</td>
                  <td>${r.turma}</td>
                  <td>${r.atividade}</td>
                  <td>${r.nota || "-"}</td>
                  <td>${r.conceito || "-"}</td>
                  <td>${r.presenca ? "Presente" : "Faltou"}</td>
                  <td>${r.horas || "-"}</td>
                  <td>${r.status}</td>
                  <td>${r.professores || "-"}</td>
                </tr>
              `).join("")}
            </table>

            <p>
              <a class="btn excel" href="/download/excel?turma_id=${turma_id}&professor_id=${professor_id || ""}&atividade_id=${atividade_id || ""}&presenca=${presenca || ""}&conceito=${conceito || ""}&status=${status || ""}">⬇ Baixar Excel</a>
              <a class="btn pdf" href="/download/pdf?turma_id=${turma_id}&professor_id=${professor_id || ""}&atividade_id=${atividade_id || ""}&presenca=${presenca || ""}&conceito=${conceito || ""}&status=${status || ""}">⬇ Baixar PDF</a>
            </p>
          </main>

          <script>
            function toggleTheme() {
              const html = document.documentElement;
              const current = html.getAttribute("data-theme");
              const newTheme = current === "dark" ? "light" : "dark";
              html.setAttribute("data-theme", newTheme);
              localStorage.setItem("theme", newTheme);
              document.querySelector(".theme-toggle").textContent = newTheme === "dark" ? "☀️" : "🌙";
            }
            (function() {
              const saved = localStorage.getItem("theme") || "light";
              document.documentElement.setAttribute("data-theme", saved);
              document.querySelector(".theme-toggle").textContent = saved === "dark" ? "☀️" : "🌙";
            })();
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    res.send("Erro ao gerar relatório: " + err.message);
  }
});

// rota download excel
app.get("/download/excel", async (req, res) => {
  const rows = await buscarRelatorio(req.query);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Relatório");

  sheet.columns = [
    { header: "Aluno", key: "aluno" },
    { header: "Email", key: "email" },
    { header: "Turma", key: "turma" },
    { header: "Atividade", key: "atividade" },
    { header: "Nota", key: "nota" },
    { header: "Conceito", key: "conceito" },
    { header: "Presença", key: "presenca" },
    { header: "Horas", key: "horas" },
    { header: "Status", key: "status" },
    { header: "Professor(es)", key: "professores" },
  ];

  rows.forEach(r => {
    sheet.addRow({
      ...r,
      presenca: r.presenca ? "Presente" : "Faltou"
    });
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=relatorio.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

// rota download pdf
app.get("/download/pdf", async (req, res) => {
  const rows = await buscarRelatorio(req.query);

  const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
  res.setHeader("Content-Disposition", "attachment; filename=relatorio.pdf");
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  doc.fontSize(18).text("Relatório da Turma", { align: "center" });
  doc.moveDown();

  const tableTop = 100;
  const colWidths = [80, 120, 60, 100, 40, 60, 60, 50, 80, 120];
  const headers = ["Aluno", "Email", "Turma", "Atividade", "Nota", "Conceito", "Presença", "Horas", "Status", "Professor(es)"];

  let x = 30;
  headers.forEach((h, i) => {
    doc.font("Helvetica-Bold").fontSize(10).text(h, x, tableTop, { width: colWidths[i], align: "center" });
    x += colWidths[i];
  });

  let y = tableTop + 20;
  rows.forEach(r => {
    let x = 30;
    const valores = [
      r.aluno,
      r.email,
      r.turma,
      r.atividade,
      r.nota || "-",
      r.conceito || "-",
      r.presenca ? "Presente" : "Faltou",
      r.horas || "-",
      r.status,
      r.professores || "-"
    ];
    valores.forEach((val, i) => {
      doc.font("Helvetica").fontSize(9).text(String(val), x, y, { width: colWidths[i], align: "center" });
      x += colWidths[i];
    });
    y += 20;
    if (y > 500) {
      doc.addPage({ size: "A4", layout: "landscape" });
      y = 50;
    }
  });

  doc.end();
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
