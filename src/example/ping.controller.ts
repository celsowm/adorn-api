import { Contract, Controller, Get } from '../core/decorators/index.js';
import type { HttpContext } from '../http/context.js';
import { registerContract } from '../contracts/builder.js';

export const PingContract = registerContract('Ping', {
  mode: 'single',
  schemas: {
    output: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        time: { type: 'string' }
      },
      required: ['ok', 'time']
    }
  }
});

@Controller({ path: '/ping' })
export class PingController {
  @Get('/')
  @Contract(PingContract)
  async ping(_ctx: HttpContext): Promise<{ ok: boolean; time: string }> {
    return { ok: true, time: new Date().toISOString() };
  }
}
