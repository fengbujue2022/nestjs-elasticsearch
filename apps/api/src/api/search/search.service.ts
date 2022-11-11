import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import {
  SearchRequest,
  QueryDslQueryContainer,
} from '@elastic/elasticsearch/lib/api/types';
import { SearchDto } from './dto/search.dto';
import merge from 'lodash.merge';
import { faker } from '@faker-js/faker';
import dayjs from 'dayjs';

const INDEX_NAME = 'openjob';

interface OpenJobDocument {
  jobId: number;
  name: string;
  companyName: string;
  districtIds: number[];
  createDate: Date;
}

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

    return request;
  }

  async search(searchDto: SearchDto) {
    const params = this.buildSearchRequest(searchDto);
    const result = await this.elasticsearchService.search(params);
    return result;
  }

  async bulkCreateIndexDocuments() {
    const isExists = await this.elasticsearchService.indices.exists({
      index: INDEX_NAME,
    });

    if (!isExists) {
      await this.elasticsearchService.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: {
            jobId: { type: 'integer' },
            name: { type: 'keyword' },
            companyName: { type: 'text' },
            districtIds: { type: 'text' },
            createDate: { type: 'date' },
          },
        },
      });
    }

    const generateFakeDocument = (id: number) => {
      return {
        jobId: id,
        name: faker.name.jobTitle(),
        companyName: faker.company.name(),
        districtIds: Array(Number(faker.random.numeric()))
          .fill(0)
          .map(() => Number(faker.random.numeric(3))),
        createDate: faker.date.between(
          '2022-01-01T00:00:00.000Z',
          '2022-11-09T00:00:00.000Z',
        ),
      } as OpenJobDocument;
    };

    const documents: OpenJobDocument[] = Array(10000)
      .fill(0)
      .map((_, index) => {
        return generateFakeDocument(index);
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
}
