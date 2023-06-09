import { Module } from '@nestjs/common';
import { ScheduledJobController } from './scheduled-job.controller';
import { ScheduledJobService } from './scheduled-job.service';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ElasticsearchModule.register({
      node: 'http://localhost:9200',
    }),
    HttpModule.register({}),
  ],
  providers: [ScheduledJobService],
  controllers: [ScheduledJobController],
})
export class JobModule {}
