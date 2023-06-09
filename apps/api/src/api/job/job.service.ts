import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from 'nestjs-prisma';
import { getRandomInt } from 'src/common/utils';
import companyNameJson from 'src/data/companyName.json';

function getCompanyName(index: number) {
  const countryCode = getRandomInt(0, 1) === 1 ? 'cn' : 'us';
  const data = companyNameJson[countryCode];
  const max = data.length - 1;
  return data[index % max];
}

function generateFakeJob(index: number): Prisma.JobCreateManyInput {
  const template = 'YYYY-MM-DDTHH:mm:ss:SSS[Z]';

  const startDate = faker.date.between(
    '2022-01-01T00:00:00.000Z',
    '2023-12-01T00:00:00.000Z',
  );

  const endDate = faker.date.between(
    dayjs(startDate).format(template),
    dayjs(startDate).add(1, 'years').format(template),
  );

  // create date should earlier than start date
  const createdAt = faker.date.between(
    '2022-01-01T00:00:00.000Z',
    dayjs(startDate).format(template),
  );

  const salaryFrom = Number(
    getRandomInt(0, 1) ? faker.random.numeric(1) : faker.random.numeric(2),
  );
  const salaryTo = getRandomInt(salaryFrom, salaryFrom * 1.5);

  return {
    districtId: Number(faker.random.numeric(getRandomInt(3, 4))),
    name: getCompanyName(index),
    companyName: getCompanyName(index),
    salaryFrom: salaryFrom * 1000,
    salaryTo: salaryTo * 1000,
    lat: faker.address.latitude(23, 22, 6),
    lon: faker.address.longitude(115, 113, 6),
    startDate,
    endDate,
    createdAt,
  };
}

@Injectable()
export class JobService {
  constructor(private readonly prisma: PrismaService) {}

  async batchInsert() {
    await this.prisma.job.createMany({
      data: [],
    });
    await this.prisma.$transaction(async (tx) => {
      const size = 1000;

      await tx.job.createMany({
        data: Array(size)
          .fill(0)
          .map((_, index) => generateFakeJob(index)),
      });
      const latestIds = await tx.$queryRaw<
        number[]
      >`SELECT JobId FROM Job ORDER BY JobId DESC LIMIT ${size}`;

      await tx.jobCategory.createMany({ data: [] });
    });
  }
}
