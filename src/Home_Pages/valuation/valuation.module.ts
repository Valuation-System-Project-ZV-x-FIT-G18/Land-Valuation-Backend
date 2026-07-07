import { Module } from '@nestjs/common'
import { ValuationController } from './valuation.controller'
import { ValuationService } from './valuation.service'

@Module({
  controllers: [ValuationController],
  providers: [ValuationService],
})
export class ValuationModule {}
