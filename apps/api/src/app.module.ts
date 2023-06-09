import { Logger, Module } from '@nestjs/common';
import { SearchModule } from '@api/search/search.module';
import { APP_FILTER } from '@nestjs/core';
import { ExceptionsFilter } from './common/filters/exceptions.filter';
import { loggingMiddleware, PrismaModule } from 'nestjs-prisma';

@Module({
  imports: [
    PrismaModule.forRoot({
      isGlobal: true,
      prismaServiceOptions: {
        middlewares: [
          loggingMiddleware({
            logger: new Logger('PrismaMiddleware'),
            logLevel: 'log',
          }),
        ],
      },
    }),
    SearchModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ExceptionsFilter }],
})
export class AppModule {}
