import { Logger } from '@nestjs/common';

const logger = new Logger('SERVER');

async function bootstrap() {

    logger.verbose(' ==> Loading Finished <==');
}
bootstrap();
