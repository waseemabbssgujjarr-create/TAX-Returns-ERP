const next = require('next');
const { createServer } = require('http');

const app = next({ dev: false, dir: __dirname, hostname: '0.0.0.0' });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const port = Number(process.env.PORT);
    createServer((req, res) => {
      handle(req, res);
    }).listen(port, '0.0.0.0', () => {
      console.log(`TaxDesk web listening on ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start TaxDesk web:', err);
    process.exit(1);
  });
