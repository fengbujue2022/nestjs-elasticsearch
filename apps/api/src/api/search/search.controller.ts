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

@Controller('api/v1/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('test')
  async test(@Query() searchDto: SearchDto, @Req() request: Request) {
    console.log(searchDto);
    console.log(request.query);
  }

  @Get('')
  async search(@Query() searchDto: SearchDto) {
    console.log(searchDto);
    return await this.searchService.search(searchDto);
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
