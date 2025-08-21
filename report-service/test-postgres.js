import pkg from "pg";
const { Client } = pkg;


async function main() {
  const client = new Client({
    host: "localhost",
    port: 5432,
    user: "postgres",       // confere com docker-compose.yml
    password: "postgres",   // confere com docker-compose.yml
    database: "residencia"  // confere com POSTGRES_DB
  });

  try {
    await client.connect();
    console.log("✅ Conectado ao Postgres!");
    const res = await client.query("SELECT NOW()");
    console.log("Hora atual no banco:", res.rows[0]);
  } catch (err) {
    console.error("❌ Erro no Postgres:", err);
  } finally {
    await client.end();
  }
}

main();
