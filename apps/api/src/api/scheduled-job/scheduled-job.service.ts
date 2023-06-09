import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from 'nestjs-prisma';
import { Enum_EsIndex } from 'src/constants/enum';
import { getRandomInt } from 'src/common/utils';
import companyNameJson from 'src/data/companyName.json';
import jobCategoryJson from 'src/data/jobCategory.json';

function getCompanyName(index: number, country: 'cn' | 'us') {
  const data = companyNameJson[country];
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
    name: getCompanyName(index, 'cn'),
    companyName1: getCompanyName(index, 'cn'),
    companyName2: getCompanyName(index, 'us'),
    salaryFrom: salaryFrom * 1000,
    salaryTo: salaryTo * 1000,
    lat: faker.address.latitude(23, 22, 6),
    lon: faker.address.longitude(115, 113, 6),
    startDate,
    endDate,
    createdAt,
    updatedAt: createdAt,
  };
}

function mapToJobValueSqlList(jobs: Prisma.JobCreateManyInput[]): Prisma.Sql[] {
  function toValueSql(input: Prisma.JobCreateManyInput) {
    const {
      districtId,
      name,
      companyName1,
      companyName2,
      startDate,
      endDate,
      salaryFrom,
      salaryTo,
      lat,
      lon,
    } = input;
    return Prisma.sql`(${districtId}, ${name}, ${companyName1},${companyName2}, ${startDate}, ${endDate}, ${salaryFrom}, ${salaryTo}, ${lat}, ${lon})`;
  }

  return jobs.map((j) => toValueSql(j));
}

@Injectable()
export class ScheduledJobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async initJobCategory(): Promise<boolean> {
    const hasInit = await this.prisma.jobCategory.count();
    if (hasInit) {
      const { count } = await this.prisma.jobCategory.createMany({
        data: jobCategoryJson.us.map((c) => {
          return {
            name: c,
          };
        }),
      });
      return count === jobCategoryJson.us.length;
    }
    return true;
  }

  async batchInsertJob() {
    await this.prisma.job.createMany({
      data: [],
    });

    await this.prisma.$transaction(
      async (tx) => {
        const batchSize = 1000;
        const valueSqlList = mapToJobValueSqlList(
          Array(batchSize)
            .fill(0)
            .map((_, index) => generateFakeJob(index)),
        );

        const lastId = await tx.$queryRaw<number>`
            INSERT INTO Job 
            (DistrictId,
            Name, 
            CompanyName1, 
            CompanyName2, 
            StartDate,
            EndDate, 
            SalaryFrom, 
            SalaryTo, 
            Lat, 
            Lon
            ) VALUES ${Prisma.join(valueSqlList)};
            SELECT LAST_INSERT_ID();
            `;

        const jobs = await tx.job.findMany({
          where: {
            jobId: {
              lte: lastId,
            },
          },
          select: {
            jobId: true,
          },
          take: batchSize,
        });

        const categories = await tx.jobCategory.findMany();

        await tx.jobCategoryJob.createMany({
          data: jobs.map((j) => {
            return {
              jobId: j.jobId,
              jobCategoryId:
                categories[getRandomInt(0, categories.length - 1)]
                  .jobCategoryId,
              typeId: 1,
            };
          }),
        });
      },
      { timeout: 1000 * 60 },
    );
  }

  async syncTodayJobsToElasticsearch() {
    await Promise.resolve(0);
    const now = dayjs().toDate();
    const jobs = await this.prisma.job.findMany({
      where: {
        updatedAt: {
          lte: now,
        },
      },
    });

    const operations = [].flatMap((doc) => [
      { index: { _index: Enum_EsIndex.Jobs } },
      doc,
    ]);

    await this.elasticsearchService.bulk(
      {
        refresh: true,
        operations,
      },
      { compression: true },
    );
  }
}
