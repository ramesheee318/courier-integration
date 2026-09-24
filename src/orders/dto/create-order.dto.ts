import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsString()
  email: string;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  country: string;

  @IsString()
  @Length(6, 6)
  pincode: string;
}

class PackageDto {
  @IsNumber()
  @Min(0.001)
  weight: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  length?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  pieces?: number;

  @IsOptional()
  @IsString()
  item_description?: string;
}

class PaymentDto {
  @IsIn(['PREPAID', 'COD'])
  type: 'PREPAID' | 'COD';

  @IsNumber()
  @Min(0)
  amount: number;
}

class InvoiceDto {
  @IsString()
  number: string;

  @IsDateString()
  date: string;

  @IsNumber()
  @Min(0)
  value: number;
}

export class CreateOrderDto {
  @IsString()
  order_id: string;

  @IsString()
  courier_partner: string;

  @ValidateNested()
  @Type(() => AddressDto)
  pickup: AddressDto;

  @ValidateNested()
  @Type(() => AddressDto)
  delivery: AddressDto;

  @ValidateNested()
  @Type(() => PackageDto)
  package: PackageDto;

  @ValidateNested()
  @Type(() => PaymentDto)
  payment: PaymentDto;

  @ValidateNested()
  @Type(() => InvoiceDto)
  invoice: InvoiceDto;
}
