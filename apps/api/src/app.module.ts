import { Logger, Module } from '@nestjs/common';
import { SearchModule } from '@api/search/search.module';
import { APP_FILTER } from '@nestjs/core';
import { ExceptionsFilter } from './common/filters/exceptions.filter';
import { ScheduleModule } from '@nestjs/schedule';
import { loggingMiddleware, PrismaModule } from 'nestjs-prisma';
import { JobModule } from '@api/scheduled-job/scheduled-job.module';

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
    ScheduleModule.forRoot(),
    SearchModule,
    JobModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ExceptionsFilter }],
})
export class AppModule {}
