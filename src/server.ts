import fastify from "fastify"

const app = fastify()

app.listen({
    host: '0.0.0.0',
    port: 3333
}).then(() => {
    console.log('Http Server Running at http://localhost:3333')
})