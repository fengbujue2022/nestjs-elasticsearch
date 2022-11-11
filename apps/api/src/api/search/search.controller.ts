import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SearchService } from '@api/search/search.service';
import { SearchDto } from './dto/search.dto';

@Controller('api/v1/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('')
  async search(@Query() searchDto: SearchDto) {
    return await this.searchService.search(searchDto);
  }

  @Get('bulkCreate')
  async bulkCreate() {
    return await this.searchService.bulkCreateIndexDocuments();
  }
}
