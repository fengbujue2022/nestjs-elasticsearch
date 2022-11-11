import { Module } from '@nestjs/common';
import { SearchModule } from '@api/search/search.module';
import { APP_FILTER } from '@nestjs/core';
import { ExceptionsFilter } from './common/filters/exceptions.filter';

@Module({
  imports: [SearchModule],
  providers: [{ provide: APP_FILTER, useClass: ExceptionsFilter }],
})
export class AppModule {}
