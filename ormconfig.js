const { ConnectionStringParser } = require("connection-string-parser");

const parser = new ConnectionStringParser({
  scheme: "postgres",
});

const parsed = parser.parse(process.env.DATABASE_URL);
const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  type: "postgres",
  host: parsed.hosts[0].host || "localhost",
  port: parsed.hosts[0].port || 5432,
  username: parsed.username || "keeper",
  password: parsed.password || "keeper",
  database: parsed.endpoint || "keeper",
  synchronize: process.env.DB_SYNCHRONIZE === "true",
  logging: process.env.DEBUG === "true",
  entities: [isProduction ? "build/src/entities/**/*.js" : "src/entities/**/*.ts"],
  migrations: [isProduction ? "build/src/migration/**/*.js" : "src/migration/**/*.ts"],
  subscribers: [isProduction ? "build/src/subscriber/**/*.js" : "src/subscriber/**/*.ts"],
  ssl: parsed.hosts[0].host !== "localhost",
  cli: {
    entitiesDir: isProduction ? "build/src/entities" : "src/entities",
    migrationsDir: isProduction ? "build/src/migration" : "src/migration",
    subscribersDir: isProduction ? "build/src/subscriber" : "src/subscriber",
  },
};
