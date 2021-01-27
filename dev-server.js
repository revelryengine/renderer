import serve from 'koa-static-server';
import Koa from 'koa';
const app = new Koa();

app.use(serve({ rootDir: 'lib',    rootPath: '/lib',    log: true }));
app.use(serve({ rootDir: 'vendor', rootPath: '/vendor', log: true }));
app.use(serve({ rootDir: 'docs', log: true }));

app.listen(8080, (err) => {
  if(err) return console.warn(err);
  console.log('listening on port 8080');
});
