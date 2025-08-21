// src/dbTurmaReportGenerator.js
import ExcelJS from "exceljs";
import { pool } from "./db.js";
import { resolveStoragePath } from "./storage.js";
import { randomUUID } from "crypto";

/**
 * Gera um relatório XLSX de notas e presença por turma
 * @param {number} turmaId - ID da turma
 */
export async function generateTurmaReport(turmaId) {
  const fileName = `turma-${turmaId}-${Date.now()}-${randomUUID()}.xlsx`;
  const filePath = resolveStoragePath(fileName);

  // Busca dados da turma, alunos e participações
  const query = `
    SELECT 
      a.id AS aluno_id,
      a.nome AS aluno_nome,
      a.email,
      t.nome AS turma_nome,
      atv.nome AS atividade,
      atv.tipo,
      p.presenca,
      p.horas,
      p.nota,
      p.conceito,
      p.status_avaliacao
    FROM participacoes p
    JOIN alunos a ON a.id = p.aluno_id
    JOIN atividades atv ON atv.id = p.atividade_id
    JOIN turmas t ON t.id = p.turma_id
    WHERE p.turma_id = $1
    ORDER BY a.id, atv.id;
  `;

  const result = await pool.query(query, [turmaId]);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Relatório Turma");

  // Cabeçalhos
  sheet.addRow([
    "ID Aluno",
    "Nome",
    "Email",
    "Turma",
    "Atividade",
    "Tipo",
    "Presença",
    "Horas",
    "Nota",
    "Conceito",
    "Status Avaliação"
  ]);

  // Linhas
  result.rows.forEach((row) => {
    sheet.addRow([
      row.aluno_id,
      row.aluno_nome,
      row.email,
      row.turma_nome,
      row.atividade,
      row.tipo,
      row.presenca ? "Presente" : "Faltou",
      row.horas,
      row.nota,
      row.conceito,
      row.status_avaliacao
    ]);
  });

  await workbook.xlsx.writeFile(filePath);

  return { filePath, fileName };
}
