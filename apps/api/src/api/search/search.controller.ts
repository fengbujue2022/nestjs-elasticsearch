import {
  ArgumentMetadata,
  Body,
  Controller,
  Delete,
  Get,
  PipeTransform,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { SearchService } from '@api/search/search.service';
import { SearchDto } from './dto/search.dto';
import { Request } from 'express';
import { hasValue } from 'src/common/utils';
import { SearchTotalHits } from '@elastic/elasticsearch/lib/api/types';

@Controller('api/v1/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('test')
  async test(@Body() searchDto: SearchDto, @Req() request: Request) {
    console.log(searchDto);
    console.log(request.query);
    return 'OK';
  }

  @Post('')
  async search(@Body() searchDto: SearchDto) {
    const searchResponse = await this.searchService.search(searchDto);
    if (hasValue(searchResponse.hits)) {
      return {
        count: (searchResponse.hits.total as SearchTotalHits).value,
        data: searchResponse.hits.hits.map((x) => x._source),
      };
    }
    return [];
  }

  @Post('bulkCreate')
  async bulkCreate() {
    const batch = 10;
    let isSuccess = false;
    for (let i = 0; i < batch; i++) {
      const result = await this.searchService.bulkCreateIndexDocuments();
      isSuccess = result.errors === false;
      if (isSuccess === false) {
        break;
      }
    }
    return isSuccess;
  }

  @Put('config')
  async putSettings() {
    return await this.searchService.applyIndexConfig();
  }

  @Delete('index')
  async delete() {
    return await this.searchService.deleteAll();
  }
}
