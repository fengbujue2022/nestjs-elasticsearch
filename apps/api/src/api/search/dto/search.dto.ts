import { ApiProperty } from '@nestjs/swagger';
import { Enum_SearchSort } from 'src/constants/enum';
import { IsNumber, IsArray, IsString, IsOptional } from 'class-validator';
export class SearchDto {
  @ApiProperty({ type: 'string', required: false, isArray: true })
  @IsArray()
  @IsOptional()
  public withinIds?: string[];

  @ApiProperty({ type: 'number', required: false, isArray: true })
  @IsArray()
  @IsOptional()
  public districtIds?: number[];

  @ApiProperty({ type: 'number', required: false, isArray: true })
  @IsArray()
  @IsOptional()
  public functionIds?: number[];

  @ApiProperty({ type: 'number', required: false })
  @IsNumber()
  @IsOptional()
  public salaryFrom?: string;

  @ApiProperty({ type: 'number', required: false })
  @IsNumber()
  @IsOptional()
  public salaryTo?: string;

  @ApiProperty({ type: 'string', required: false })
  @IsString()
  @IsOptional()
  public query?: string;

  // geo
  @ApiProperty({ type: 'number', required: false })
  @IsNumber()
  @IsOptional()
  public lat?: string;

  @ApiProperty({ type: 'number', required: false })
  @IsNumber()
  @IsOptional()
  public lon?: string;

  // paging
  @ApiProperty({ type: 'number', required: false })
  @IsNumber()
  @IsOptional()
  public startAt: number;

  @ApiProperty({ type: 'number', required: false })
  @IsNumber()
  @IsOptional()
  public rows: number;

  @ApiProperty({ type: 'string', required: false })
  @IsString()
  @IsOptional()
  public next?: string;

  @ApiProperty({ enum: [Enum_SearchSort.Relevant, Enum_SearchSort.DateDesc] })
  @IsNumber()
  @IsOptional()
  public sort?: Enum_SearchSort;
}
