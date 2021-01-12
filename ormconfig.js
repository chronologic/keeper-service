const { ConnectionStringParser } = require('connection-string-parser');

const parser = new ConnectionStringParser({
  scheme: 'postgres',
});

const parsed = parser.parse(process.env.DB_URL);
const { host, port } = parsed.hosts[0];

module.exports = {
  type: 'postgres',
  host: host || 'localhost',
  port: port || 5432,
  username: parsed.username || 'keeper',
  password: parsed.password || 'keeper',
  database: parsed.endpoint || 'keeper',
  synchronize: process.env.DB_SYNC === 'true',
  logging: process.env.LOG_LEVEL === 'debug',
  entities: ['build/src/entities/**/*.js', 'src/entities/**/*.ts'],
  migrations: ['build/src/migrations/**/*.js', 'src/migrations/**/*.ts'],
  subscribers: ['build/src/subscribers/**/*.js', 'src/subscribers/**/*.ts'],
  ssl: host !== 'localhost',
};
