// dbReportGenerator.js
import ExcelJS from "exceljs";
import { pool } from "./db.js";
import { resolveStoragePath } from "./storage.js";
import { randomUUID } from "crypto";

/**
 * Gera um relatório XLSX com os alunos cadastrados no banco
 * @returns {Promise<{ filePath: string, fileName: string }>}
 */
export async function generateAlunosReport() {
  const fileName = `alunos-${Date.now()}-${randomUUID()}.xlsx`;
  const filePath = resolveStoragePath(fileName);

  // Busca dados no banco
  const result = await pool.query("SELECT id, nome, email FROM alunos ORDER BY id ASC");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Alunos");

  // Cabeçalhos
  sheet.addRow(["ID", "Nome", "Email"]);

  // Linhas
  result.rows.forEach((aluno) => {
    sheet.addRow([aluno.id, aluno.nome, aluno.email]);
  });

  await workbook.xlsx.writeFile(filePath);

  return { filePath, fileName };
}
