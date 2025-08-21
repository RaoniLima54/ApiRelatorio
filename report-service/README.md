# Report Service — Geração Assíncrona de Relatórios (Node.js + BullMQ + Redis + ExcelJS)

## Pré-requisitos
- Node.js 18+
- Docker Desktop (ou Docker Engine) — para subir o Redis rapidamente

## 1) Subir o Redis
```bash
docker compose up -d
```

## 2) Instalar dependências
```bash
npm install
cp .env.example .env
```
Edite `.env` se quiser mudar porta/URLs.

## 3) Rodar API e Worker (dois terminais)
```bash
# terminal 1
npm run start

# terminal 2
npm run worker
```

## 4) Testes rápidos
### Criar job (20k linhas)
```bash
curl -X POST http://localhost:3000/reports -H "Content-Type: application/json" -d '{"rows": 20000, "columns": 12, "title": "Relatório Bonsae"}'
```
Resposta esperada (exemplo):
```json
{
  "jobId": "123",
  "statusUrl": "http://localhost:3000/reports/123",
  "downloadUrl": "http://localhost:3000/reports/123/download"
}
```

### Consultar status
```bash
curl http://localhost:3000/reports/123
```

### Baixar quando pronto
```bash
curl -OJ http://localhost:3000/reports/123/download
```

## Observações de performance
- ExcelJS (streaming) evita carregar tudo em memória; praticável com 100k+ linhas.
- Ajuste `JOB_CONCURRENCY` conforme CPU/RAM no `.env`.
- Retentativas/backoff configuráveis.

## Extensões (opcionais)
- PDF com Puppeteer.
- URLs assinadas (S3) para download.
- Autenticação (JWT) nas rotas.
- Banco (Postgres) para histórico de relatórios.
