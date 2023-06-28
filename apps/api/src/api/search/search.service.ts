import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import {
  SearchRequest,
  QueryDslQueryContainer,
  PropertyName,
  MappingProperty,
  IndicesIndexSettings,
  QueryDslRangeQuery,
} from '@elastic/elasticsearch/lib/api/types';
import { SearchDto } from './dto/search.dto';
import merge from 'lodash.merge';
import { hasValue } from 'src/common/utils';
import { Enum_EsIndex, Enum_SearchSort } from 'src/constants/enum';

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

const MAPPING_PROPERTIES: Record<PropertyName, MappingProperty> = {
  jobId: { type: 'keyword' }, // 如果是text ，terms将不会命中， 可能和analyze有关
  name: {
    type: 'text',
    analyzer: 'ik_syno_smart',
    search_analyzer: 'ik_syno_smart',
  },
  companyName1: {
    type: 'text',
    analyzer: 'ik_syno_smart',
    search_analyzer: 'ik_syno_smart',
  },
  companyName2: {
    type: 'text',
    analyzer: 'en_analyzer',
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
  // 'indexing.slowlog': {
  //   threshold: {
  //     query: {
  //       info: '0s',
  //     },
  //   },
  // },
  analysis: {
    tokenizer: {
      ngram_tokenizer: {
        type: 'ngram',
        min_gram: 2,
        max_gram: 3,
        token_chars: ['letter', 'digit'],
      },
    },
    analyzer: {
      en_analyzer: {
        type: 'custom',
        tokenizer: 'ngram_tokenizer',
        filter: ['my_stopword', 'my_synonym'],
      },
      ik_syno_smart: {
        type: 'custom',
        tokenizer: 'ik_smart',
        filter: ['my_stopword', 'my_synonym'],
      },
      ik_syno_max: {
        type: 'custom',
        tokenizer: 'ik_max_word',
        filter: ['my_stopword', 'my_synonym'],
      },
    },
    filter: {
      my_synonym: {
        type: 'synonym',
        synonyms_path: 'analysis/synonym.txt',
      },
      my_stopword: {
        type: 'stop',
        stopwords_path: 'analysis/stopwords.txt',
      },
    },
  },
};

@Injectable()
export class SearchService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  private buildSearchRequest(searchDto: SearchDto): SearchRequest {
    const request: SearchRequest = {
      index: Enum_EsIndex.Jobs,
      query: {},
    };
    const query = request.query;

    const mergeIntoQuery = (toMerged: QueryDslQueryContainer) => {
      return merge(query, toMerged);
    };

    // withinIds
    if (hasValue(searchDto.withinIds)) {
      mergeIntoQuery({
        bool: {
          filter: [
            {
              terms: {
                jobId: searchDto.withinIds.map((d) => d.toString()),
              },
            },
          ],
        },
      });
    }

    // districtIds
    if (hasValue(searchDto.districtIds)) {
      mergeIntoQuery({
        bool: {
          filter: [
            {
              terms: {
                districtId: searchDto.districtIds.map((d) => d.toString()),
              },
            },
          ],
        },
      });
    }

    // functionIds
    if (hasValue(searchDto.functionIds)) {
      mergeIntoQuery({
        bool: {
          filter: [
            {
              terms: {
                functionIds: searchDto.functionIds.map((d) => d.toString()),
              },
            },
          ],
        },
      });
    }

    // salary range
    if (hasValue(searchDto.salaryFrom) || hasValue(searchDto.salaryTo)) {
      let rangeDSLQuery: Partial<Record<string, QueryDslRangeQuery>> = {};

      if (hasValue(searchDto.salaryFrom)) {
        rangeDSLQuery = {
          ...rangeDSLQuery,
          salaryFrom: {
            gte: searchDto.salaryFrom,
          },
        };
      }

      if (hasValue(searchDto.salaryTo)) {
        rangeDSLQuery = {
          ...rangeDSLQuery,
          salaryTo: {
            lte: searchDto.salaryTo,
          },
        };
      }

      mergeIntoQuery({
        bool: {
          must: [{ range: rangeDSLQuery }],
        },
      });
    }

    // query
    if (hasValue(searchDto.query)) {
      mergeIntoQuery({
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    match_phrase: {
                      companyName1: {
                        query: searchDto.query,
                        //minimum_should_match: searchDto.query.length,
                      },
                    },
                  },
                  {
                    match_phrase: {
                      companyName2: {
                        query: searchDto.query,
                        //minimum_should_match: searchDto.query.length,
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      });
    }

    // sort
    if (searchDto.sort === Enum_SearchSort.DateDesc) {
      request.sort = [
        {
          startDate: { order: 'desc' },
        },
      ];
    }

    request.size = searchDto.rows ?? 20;
    request.from = searchDto.startAt;
    return request;
  }

  async search(searchDto: SearchDto) {
    const params = this.buildSearchRequest(searchDto);
    console.log('debug:searchRequest:\n', JSON.stringify(params));
    const result = await this.elasticsearchService.search(params);
    return result;
  }

  async applyIndexConfig() {
    const aliasName = Enum_EsIndex.Jobs;

    let currentIndex_list: string[] = [];
    try {
      const indices = await this.elasticsearchService.indices.getAlias({
        name: aliasName,
      });
      currentIndex_list = Object.keys(indices);
    } catch (e) {
      console.log(e);
    }
    const newIndex = `${Enum_EsIndex.Jobs}_${Date.now()}`;

    await this.elasticsearchService.indices.create({
      index: newIndex,
      settings: {
        analysis: {
          analyzer: {
            edge_analyzer: {
              type: 'custom',
              tokenizer: 'edge_tokenizer',
              filter: ['lowercase', 'asciifolding'],
            },
            edge_w_space_analyzer: {
              type: 'custom',
              tokenizer: 'edge_w_space_tokenizer',
              filter: ['lowercase', 'asciifolding'],
            },
            edge_query_analyzer: {
              type: 'custom',
              tokenizer: 'keyword',
              filter: ['lowercase', 'asciifolding'],
            },
            standard_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'asciifolding'],
            },
          },
          tokenizer: {
            edge_tokenizer: {
              type: 'edge_ngram',
              min_gram: 1,
              max_gram: 10,
              token_chars: ['letter', 'digit'],
            },
            edge_w_space_tokenizer: {
              type: 'edge_ngram',
              min_gram: 1,
              max_gram: 10,
              token_chars: ['whitespace'],
            },
          },
        },
      },
      mappings: {
        properties: {
          job_suggestion_id: {
            type: 'integer',
          },
          typeid: {
            type: 'integer',
          },
          sort_order: {
            type: 'integer',
          },
        },
        dynamic_templates: [
          {
            name_type: {
              match_mapping_type: 'string',
              match: 'searchtext_*',
              mapping: {
                fields: {
                  keyword: {
                    type: 'keyword',
                    similarity: 'boolean',
                  },
                  full_text: {
                    type: 'text',
                    analyzer: 'standard_analyzer',
                  },
                  edge: {
                    type: 'text',
                    analyzer: 'edge_analyzer',
                    similarity: 'boolean',
                    search_analyzer: 'edge_query_analyzer',
                  },
                  edge_w_space: {
                    type: 'text',
                    analyzer: 'edge_w_space_analyzer',
                    similarity: 'boolean',
                    search_analyzer: 'edge_query_analyzer',
                  },
                },
              },
            },
          },
        ],
      },
    });

    const operations = [
      {
        job_suggestion_id: 13,
        typeid: 1,
        searchtext_1: '北京大学城市学院',
        searchtext_2: 'Peking University City College',
        searchtext_3: '北京大學城市學院',
        sort_order: 1,
      },
    ].flatMap((doc) => [{ index: { _index: newIndex } }, doc]);

    await this.elasticsearchService.bulk(
      {
        refresh: true,
        operations,
      },
      { compression: true },
    );

    await this.elasticsearchService.indices.updateAliases({
      body: {
        actions: [
          ...currentIndex_list.map((x) => ({
            remove: {
              index: x,
              alias: aliasName,
            },
          })),
          {
            add: {
              index: newIndex,
              alias: aliasName,
            },
          },
        ],
      },
    });

    // Delete the old index
    if (currentIndex_list?.length) {
      await this.elasticsearchService.indices.delete({
        index: currentIndex_list,
      });
    }
    // await this.deleteAllJobsV7Index();
  }

  async deleteAllJobsV7Index() {
    const indices = await this.elasticsearchService.cat.indices({
      format: 'json',
    });

    const indexNames = indices
      .map((index) => index.index)
      .filter((indexName) => indexName.startsWith('jobs_v7'));

    for (const indexName of indexNames) {
      await this.elasticsearchService.indices.delete({ index: indexName });
    }
  }

  // async bulkCreateIndexDocuments() {
  //   const isExists = await this.elasticsearchService.indices.exists({
  //     index: INDEX_NAME,
  //   });

  //   if (!isExists) {
  //     await this.elasticsearchService.indices.create({
  //       index: INDEX_NAME,
  //       mappings: {
  //         properties: MAPPING_PROPERTIES,
  //       },
  //       settings: SETTINGS,
  //     });
  //   }

  //   const toCreateDocumentCount = 1000; // 1k

  //   const documents: OpenJobDocument[] = Array(toCreateDocumentCount)
  //     .fill(0)
  //     .map((_, index) => {
  //       return generateFakeDocument(index);
  //     });

  //   const operations = documents.flatMap((doc) => [
  //     { index: { _index: INDEX_NAME } },
  //     doc,
  //   ]);

  //   return await this.elasticsearchService.bulk(
  //     {
  //       refresh: true,
  //       operations,
  //     },
  //     { compression: true },
  //   );
  // }

  async deleteAll(): Promise<void> {
    // maybe clear documents is unnecessary
    await this.elasticsearchService.deleteByQuery({
      index: Enum_EsIndex.Jobs,
      query: {
        match_all: {},
      },
    });
    await this.elasticsearchService.indices.delete({
      index: Enum_EsIndex.Jobs,
    });
  }
}
