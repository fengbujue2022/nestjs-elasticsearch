import { Controller, Post } from '@nestjs/common';
import { JobService } from './job.service';

@Controller('api/v1/job')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post('test')
  async test() {
    return 'OK';
  }
}
