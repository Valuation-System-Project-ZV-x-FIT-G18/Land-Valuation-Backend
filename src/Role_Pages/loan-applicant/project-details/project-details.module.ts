import { Module } from '@nestjs/common'
import { ProjectDetailsController } from './project-details.controller'
import { ProjectDetailsService } from './project-details.service'

@Module({
  controllers: [ProjectDetailsController],
  providers: [ProjectDetailsService],
})
export class ProjectDetailsModule {}
