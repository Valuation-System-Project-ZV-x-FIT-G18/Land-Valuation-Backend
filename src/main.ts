import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

// Starts the NestJS server.
async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api') // every route starts with /api
  // Only our own frontend may call this API from a browser. Without an origin
  // list any website a signed-in user visits could issue requests as them.
  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  app.enableCors({ origin: allowedOrigins, credentials: true })

  // Validate every incoming request body against its DTO automatically.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  )

  const port = process.env.PORT ?? 4000
  await app.listen(port)
  console.log(`Backend running on http://localhost:${port}/api`)
}
bootstrap()
