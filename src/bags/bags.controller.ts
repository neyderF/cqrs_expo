import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { randomUUID } from 'crypto';
import {
  ConsumeInvoiceCommand,
  CreateBagCommand,
  GetClientConsolidatedQuery,
} from './commands';
import { EventStoreService } from '../shared/event-store.service';

class CreateBagDto {
  @IsOptional()
  @IsString()
  bagId?: string;

  @IsString()
  clientId!: string;

  @IsInt()
  @Min(1)
  initialQuantity!: number;
}

class ConsumeInvoiceDto {
  @IsString()
  clientId!: string;

  @IsString()
  invoiceId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

@Controller()
export class BagsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly eventStore: EventStoreService,
  ) {}

  @Post('bags')
  async createBag(@Body() body: CreateBagDto) {
    return this.commandBus.execute(
      new CreateBagCommand(
        body.bagId ?? randomUUID(),
        body.clientId,
        body.initialQuantity,
        new Date().toISOString(),
      ),
    );
  }

  @Post('bags/consume')
  async consumeInvoice(@Body() body: ConsumeInvoiceDto) {
    return this.commandBus.execute(
      new ConsumeInvoiceCommand(
        randomUUID(),
        body.clientId,
        body.invoiceId,
        body.quantity,
        new Date().toISOString(),
        'billing-system-x',
      ),
    );
  }

  @Get('clients/:clientId/consolidated')
  async getClientConsolidated(@Param('clientId') clientId: string) {
    return this.queryBus.execute(new GetClientConsolidatedQuery(clientId));
  }

  @Get('events')
  async getEvents() {
    return this.eventStore.getAll();
  }
}
