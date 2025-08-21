import express from "express";
import pkg from "pg";
import bodyParser from "body-parser";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const { Pool } = pkg;
const app = express();
const port = 3000;

// conexão banco
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "residencia",
  password: "postgres",
  port: 5432,
});

app.use(bodyParser.urlencoded({ extended: true }));

// rota inicial -> formulário
app.get("/", async (req, res) => {
  try {
    const turmas = await pool.query("SELECT id, nome FROM turmas");
    const professores = await pool.query("SELECT id, nome FROM professores");
    const atividades = await pool.query("SELECT id, nome FROM atividades");

    res.send(`
      <html>
        <head>
          <title>Gerar Relatório</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #007bff; }
            label { display: block; margin-top: 10px; font-weight: bold; }
            select, input { padding: 5px; width: 250px; }
            button { margin-top: 15px; padding: 10px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <h1>📊 Gerar Relatório da Turma</h1>
          <form method="POST" action="/relatorio">
            <label>Turma:</label>
            <select name="turma_id">
              ${turmas.rows.map(t => `<option value="${t.id}">${t.nome}</option>`).join("")}
            </select>

            <label>Professor (opcional):</label>
            <select name="professor_id">
              <option value="">-- Todos --</option>
              ${professores.rows.map(p => `<option value="${p.id}">${p.nome}</option>`).join("")}
            </select>

            <label>Atividade (opcional):</label>
            <select name="atividade_id">
              <option value="">-- Todas --</option>
              ${atividades.rows.map(a => `<option value="${a.id}">${a.nome}</option>`).join("")}
            </select>

            <label>Presença:</label>
            <select name="presenca">
              <option value="">-- Todas --</option>
              <option value="Presente">Presente</option>
              <option value="Faltou">Faltou</option>
            </select>

            <label>Conceito:</label>
            <select name="conceito">
              <option value="">-- Todos --</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="E">E</option>
            </select>

            <label>Status:</label>
            <select name="status">
              <option value="">-- Todos --</option>
              <option value="Aprovado">Aprovado</option>
              <option value="Reprovado">Reprovado</option>
            </select>

            <label>Tipo de relatório:</label>
            <select name="tipo">
              <option value="detalhado">Detalhado + Estatísticas</option>
              <option value="lista">Lista Filtrada</option>
            </select>

            <button type="submit">Gerar Relatório</button>
          </form>
        </body>
      </html>
    `);
  } catch (err) {
    res.send("Erro ao carregar filtros: " + err.message);
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

  let result = await pool.query(query, params);

  // calcular status
  result.rows.forEach(r => {
    if (r.nota === null) {
      r.status = "Pendente";
    } else if (r.nota >= 6) {
      r.status = "Aprovado";
    } else {
      r.status = "Reprovado";
    }
  });

  // aplicar filtro de status
  if (status) {
    result.rows = result.rows.filter(r => r.status === status);
  }

  return result.rows;
}

// rota relatório html
app.post("/relatorio", async (req, res) => {
  const { turma_id, professor_id, atividade_id, presenca, conceito, tipo, status } = req.body;

  try {
    const rows = await buscarRelatorio({ turma_id, professor_id, atividade_id, presenca, conceito, status });

    const total = rows.length;

    // notas convertidas para número
    const notasValidas = rows
      .map(r => typeof r.nota === "number" ? r.nota : parseFloat(r.nota))
      .filter(n => !Number.isNaN(n));

    const mediaNotas = notasValidas.length
      ? notasValidas.reduce((s, n) => s + n, 0) / notasValidas.length
      : 0;

    const frequencia = rows.filter(r => r.presenca).length / (total || 1) * 100;
    const aprovados = rows.filter(r => r.status === "Aprovado").length;
    const reprovados = rows.filter(r => r.status === "Reprovado").length;

    res.send(`
      <html>
        <head>
          <title>Relatório</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #007bff; }
            .stats { display: flex; gap: 20px; margin-bottom: 20px; }
            .card { padding: 10px 20px; background: #f8f9fa; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            th { background: #007bff; color: white; }
            .btn { margin-right: 10px; padding: 8px 12px; border-radius: 4px; text-decoration: none; color: white; }
            .excel { background: green; }
            .pdf { background: red; }
          </style>
        </head>
        <body>
          <h1>📑 Relatório Gerado</h1>

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
        </body>
      </html>
    `);
  } catch (err) {
    res.send("Erro ao gerar relatório: " + err.message);
  }
});

// rota download excel
app.get("/download/excel", async (req, res) => {
  const { turma_id, professor_id, atividade_id, presenca, conceito, status } = req.query;
  const rows = await buscarRelatorio({ turma_id, professor_id, atividade_id, presenca, conceito, status });

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
  const { turma_id, professor_id, atividade_id, presenca, conceito, status } = req.query;
  const rows = await buscarRelatorio({ turma_id, professor_id, atividade_id, presenca, conceito, status });

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
