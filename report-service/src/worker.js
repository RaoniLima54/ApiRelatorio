// worker.js
import { createWorker } from './queue.js';
import { generateLargeXlsx } from './reportGenerator.js';
import { generateAlunosReport } from './dbReportGenerator.js';
import { generateTurmaReport } from './dbTurmaReportGenerator.js';
import { config } from './config.js';

async function processor(job) {
  const { type, turmaId, rows, columns, title } = job.data || {};
  job.updateProgress({ stage: 'starting' });

  let result;

  if (type === "alunos") {
    // Relatório real: lista de alunos
    result = await generateAlunosReport();
  } else if (type === "turma") {
    // Relatório real: notas e presença de uma turma
    result = await generateTurmaReport(turmaId);
  } else {
    // Relatório fake (já existente)
    result = await generateLargeXlsx({ rows, columns, title });
  }

  job.updateProgress({ stage: 'finalizing' });

  // Retorno para salvar e permitir download
  return { fileName: result.fileName };
}

const worker = createWorker(processor);

worker.on('active', (job) => {
  console.log(`Job ${job.id} ativo...`);
});

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} concluído:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} falhou:`, err);
});

process.on('SIGINT', () => process.exit(0));
