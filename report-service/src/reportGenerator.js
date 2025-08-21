import { resolveStoragePath } from './storage.js';
import ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';

/**
 * Gera um relatório XLSX grande, de forma performática (streaming).
 * @param {{ rows: number, columns?: number, title?: string }} options
 * @returns {Promise<{ filePath: string, fileName: string }>}
 */
export async function generateLargeXlsx(options) {
  const rows = Number(options?.rows || 20000);
  const cols = Number(options?.columns || 10);
  const title = options?.title || 'Relatório de Vendas';

  const fileName = `${Date.now()}-${randomUUID()}.xlsx`;
  const filePath = resolveStoragePath(fileName);

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: filePath, useStyles: true });
  const sheet = workbook.addWorksheet('Dados');

  // Cabeçalhos
  const headers = Array.from({ length: cols }, (_, i) => `Coluna_${i + 1}`);
  sheet.addRow([`Título: ${title}`]).commit();
  sheet.addRow([`Gerado em: ${new Date().toISOString()}`]).commit();
  sheet.addRow([]).commit();
  sheet.addRow(headers).commit();

  // Linhas de exemplo (substitua pela sua fonte real de dados)
  for (let r = 1; r <= rows; r++) {
    const row = Array.from({ length: cols }, (_, c) => `R${r}C${c + 1}`);
    sheet.addRow(row).commit();
    if (r % 5000 === 0) {
      await new Promise((res) => setImmediate(res));
    }
  }

  await workbook.commit();
  return { filePath, fileName };
}
