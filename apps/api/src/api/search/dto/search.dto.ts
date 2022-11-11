import { ApiProperty } from '@nestjs/swagger';

export class SearchDto {
  @ApiProperty({ type: 'number', required: false, isArray: true })
  public withinIds: number[];
  @ApiProperty({ type: 'number', required: false, isArray: true })
  public districtIds: number[];
  @ApiProperty({ type: 'string', required: false })
  public query: string;
}
