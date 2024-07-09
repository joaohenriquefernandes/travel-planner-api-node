import cors from '@fastify/cors'
import fastify from "fastify"
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod"

const app = fastify()

app.register(cors, {
  origin: '*'
})

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

app.listen({
  host: '0.0.0.0',
  port: 3333
}).then(() => {
  console.log('Http Server Running at http://localhost:3333')
})