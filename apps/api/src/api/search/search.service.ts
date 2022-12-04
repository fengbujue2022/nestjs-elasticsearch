import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import {
  SearchRequest,
  QueryDslQueryContainer,
  PropertyName,
  MappingProperty,
  IndicesIndexSettings,
} from '@elastic/elasticsearch/lib/api/types';
import { SearchDto } from './dto/search.dto';
import merge from 'lodash.merge';
import { faker } from '@faker-js/faker';
import dayjs from 'dayjs';
import { generateUUID, getRandomInt } from 'src/common/utils';

interface OpenJobDocument {
  jobId: string;
  name: string;
  companyName1: string;
  companyName2: string;
  salaryFrom: number;
  salaryTo: number;
  districtId: number;
  functionIds: number[];
  geo: {
    lat: string;
    lon: string;
  };
  createDate: Date;
  startDate: Date;
  endDate: Date;
}

const INDEX_NAME = 'openjob';

const MAPPING_PROPERTIES: Record<PropertyName, MappingProperty> = {
  jobId: { type: 'text' },
  name: { type: 'text', analyzer: 'my_analyzer' },
  companyName1: { type: 'text', analyzer: 'my_analyzer' },
  companyName2: {
    type: 'text',
    analyzer: 'ik_max_word',
    search_analyzer: 'ik_max_word',
  },
  salaryFrom: { type: 'integer' },
  salaryTo: { type: 'integer' },
  districtId: { type: 'integer' },
  functionIds: { type: 'integer' },
  geo: { type: 'geo_point' },
  startDate: { type: 'date' },
  endDate: { type: 'date' },
  createDate: { type: 'date' },
};

const SETTINGS: IndicesIndexSettings = {
  analysis: {
    tokenizer: {
      my_tokenizer: {
        type: 'ngram',
        min_gram: 2,
        max_gram: 3,
        token_chars: ['letter', 'digit'],
      },
    },
    analyzer: {
      my_analyzer: {
        type: 'custom',
        tokenizer: 'my_tokenizer',
      },
    },
  },
};

const runInZhCNFakerJs = function <T>(fn: () => T): T {
  const stagedLocale = faker.locale;
  faker.setLocale('zh_CN');
  const result = fn();
  faker.setLocale(stagedLocale);
  return result;
};

const generateFakeDocument = (): OpenJobDocument => {
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
  const createDate = faker.date.between(
    '2022-01-01T00:00:00.000Z',
    dayjs(startDate).format(template),
  );

  const salaryFrom = Number(
    getRandomInt(0, 1) ? faker.random.numeric(1) : faker.random.numeric(2),
  );
  const salaryTo = getRandomInt(salaryFrom, salaryFrom * 1.5);

  return {
    jobId: generateUUID(),
    name: faker.name.jobTitle(),
    companyName1: faker.company.name(),
    companyName2: runInZhCNFakerJs(() => {
      return faker.company.name();
    }),
    districtId: Number(faker.random.numeric(getRandomInt(3, 4))),
    functionIds: Array(Number(faker.random.numeric()))
      .fill(0)
      .map(() => Number(faker.random.numeric(getRandomInt(3, 4)))),
    salaryFrom: salaryFrom * 1000,
    salaryTo: salaryTo * 1000,
    geo: {
      lat: faker.address.latitude(23, 22, 6),
      lon: faker.address.longitude(115, 113, 6),
    },
    startDate,
    endDate,
    createDate,
  };
};

@Injectable()
export class SearchService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  private buildSearchRequest(searchDto: SearchDto): SearchRequest {
    const request: SearchRequest = {
      index: INDEX_NAME,
      query: {},
    };
    const query = request.query;

    const mergeWithQuery = (toMerged: QueryDslQueryContainer) => {
      return merge(query, toMerged);
    };

    // withinIds
    if (searchDto.withinIds?.length) {
      mergeWithQuery({
        ids: {
          values: searchDto.withinIds.map((id) => id.toString()),
        },
      });
    }

    // districtIds
    if (searchDto.districtIds?.length) {
      mergeWithQuery({
        bool: {
          filter: [
            {
              terms: {
                districtIds: searchDto.districtIds.map((d) => d.toString()),
              },
            },
          ],
        },
      });
    }

    // query
    if (searchDto.query) {
      mergeWithQuery({
        bool: {
          must: [
            {
              match: {
                name: searchDto.query,
              },
            },
          ],
        },
      });
    }

    if (searchDto.sort === 1) {
      request.sort = [
        {
          startDate: { order: 'desc' },
        },
      ];
    }

    return request;
  }

  async search(searchDto: SearchDto) {
    const params = this.buildSearchRequest(searchDto);
    console.log('searchRequest:\n', params);
    const result = await this.elasticsearchService.search(params);
    return result;
  }

  async applyIndexConfig() {
    // close
    await this.elasticsearchService.indices.close({
      index: INDEX_NAME,
    });

    await this.elasticsearchService.indices.putSettings({
      index: INDEX_NAME,
      settings: SETTINGS,
    });

    await this.elasticsearchService.indices.putMapping({
      index: INDEX_NAME,
      properties: MAPPING_PROPERTIES,
    });

    // reopen
    await this.elasticsearchService.indices.open({
      index: INDEX_NAME,
    });
  }

  async bulkCreateIndexDocuments() {
    const isExists = await this.elasticsearchService.indices.exists({
      index: INDEX_NAME,
    });

    if (!isExists) {
      await this.elasticsearchService.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: MAPPING_PROPERTIES,
        },
        settings: SETTINGS,
      });
    }

    const toCreateDocumentCount = 1000; // 1k

    const documents: OpenJobDocument[] = Array(toCreateDocumentCount)
      .fill(0)
      .map(() => {
        return generateFakeDocument();
      });

    const operations = documents.flatMap((doc) => [
      { index: { _index: INDEX_NAME } },
      doc,
    ]);

    return await this.elasticsearchService.bulk(
      {
        refresh: true,
        operations,
      },
      { compression: true },
    );
  }

  async deleteAll(): Promise<void> {
    // maybe clear documents is unnecessary
    await this.elasticsearchService.deleteByQuery({
      index: INDEX_NAME,
      query: {
        match_all: {},
      },
    });
    await this.elasticsearchService.indices.delete({
      index: INDEX_NAME,
    });
  }
}
