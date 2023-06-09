import { Controller, Post } from '@nestjs/common';
import { ScheduledJobService } from './scheduled-job.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

@Controller('api/v1/scheduledJob')
export class ScheduledJobController {
  constructor(
    private readonly scheduledJobService: ScheduledJobService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  @Post('updateJobs')
  async updateJobs() {
    const jobsMap = new Map<string, CronJob>();

    jobsMap.set(
      'testJob',
      new CronJob(`${30} * * * * *`, () => {
        void this.scheduledJobService.initJobCategory();
      }),
    );

    jobsMap.set(
      'testJob2',
      new CronJob(`${30} * * * * *`, () => {
        console.warn(`time (${30}) for job ${name} to run!`);
      }),
    );

    for (const [key, value] of jobsMap.entries()) {
      this.schedulerRegistry.deleteCronJob(key);
      this.schedulerRegistry.addCronJob(key, value);
    }
  }
}
