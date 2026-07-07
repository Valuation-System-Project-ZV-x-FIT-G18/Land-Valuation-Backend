import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

// Starts the NestJS server.
async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api') // every route starts with /api
  app.enableCors() // allow the React frontend to call this API

  // Validate every incoming request body against its DTO automatically.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  )

  const port = process.env.PORT ?? 4000
  await app.listen(port)
  console.log(`Backend running on http://localhost:${port}/api`)
}
bootstrap()
