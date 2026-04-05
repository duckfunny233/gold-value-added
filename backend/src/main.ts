import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const prefix = process.env.API_PREFIX || 'api'
  const port = Number(process.env.PORT || 3001)
  const swaggerPath = process.env.SWAGGER_PATH || 'docs'

  app.setGlobalPrefix(prefix)
  app.enableCors()
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  )

  const swaggerConfig = new DocumentBuilder()
    .setTitle(process.env.APP_NAME || 'Jinlian GYC Backend')
    .setDescription('Modular monolith backend scaffold for GoldValueAdded')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build()

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup(swaggerPath, app, swaggerDocument)

  await app.listen(port)
}

bootstrap()
